import { Context, Next } from "koa";
import { Request, Response, OAuthError, Token } from "oauth2-server";
import { cloneDeep } from "lodash-es";
import { log, logger, requestLogger } from "../utils/logging.js";
import { canViewSession } from "../IndecisiveTypes.js";

export interface PathDefBase {
  method: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
}

export interface EndsWithPathDef extends PathDefBase {
  endsWith?: string;
}

export interface RegExpPathDef extends PathDefBase {
  matches?: RegExp;
}

export type PathDef = EndsWithPathDef | RegExpPathDef;

export function pathDefsMatch(ctx: Context, paths: PathDef[]): boolean {
  for (const pathDef of paths) {
    if (ctx.request.method !== pathDef.method) {
      continue;
    }
    if ("endsWith" in pathDef) {
      if (!ctx._matchedRoute.endsWith(pathDef.endsWith)) {
        continue;
      }
    } else if ("matches" in pathDef) {
      if (!ctx._matchedRoute.matches(pathDef.matches)) {
        continue;
      }
    }
    return true;
  }

  return false;
}

function oauthResponse(ctx: Context, response: Response, token?: Token) {
  ctx.response.status = response.status || 500;
  ctx.response.body = response.body;
  for (const header in response.headers) {
    if (header === "www-authenticate") {
      logger.http(
        `Skipping OAuth2 Header ${header}: ${response.get(
          header,
        )} due to iOS React Native issue.`,
      );
      // This is the offending header
      // ctx.response.set("www-authenticate", 'Basic realm="Service"');
      continue;
    }
    ctx.response.set(header, response.get(header));
  }
  if (token) {
    requestLogger.info({
      message: `Token: ${token.accessToken}`,
      type: "token",
      kind: "created",
      status: ctx.response.status.toString(),
      userId: token.clientId,
    });
  } else {
    requestLogger.info({
      message: `Failure in token`,
      type: "token",
      kind: "failure",
      status: ctx.response.status.toString(),
      userId: ctx.ip,
    });
  }
}

function handleOAuthError(ctx: Context, error: OAuthError) {
  logger.error(
    `OAuthError authenticating ${error.code} ${error.name} ${error.message}`,
    {
      code: error.code,
      name: error.name,
      message: error.message,
      request: {
        ip: ctx.request.ip,
        headers: ctx.request.headers,
        body: ctx.request.body,
      },
    },
  );
  ctx.response.status = error.code || 500;
  ctx.response.body = {
    error: error.name,
    error_description: error.message,
  };
  requestLogger.info({
    message: `Auth failed for ${ctx.request.method} ${ctx.path}`,
    type: "auth",
    kind: "failed",
    status: ctx.response.status.toString(),
    userId: ctx.ip,
  });
}

export async function token(ctx: Context) {
  const response = new Response();
  try {
    const request = new Request(ctx.request);
    const result = await ctx.auth.token(request, response);
    oauthResponse(ctx, response, result);
    return result;
  } catch (error) {
    if (error instanceof OAuthError) {
      logger.error(`OAuthError fetching token`, {
        code: response.status,
        request: {
          ip: ctx.request.ip,
          headers: ctx.request.headers,
          body: ctx.request.body,
        },
      });
      oauthResponse(ctx, response);
      return;
    } else {
      handleNonOAuthError(ctx, "token", error as Error);
    }
    return;
  }
}

function handleNonOAuthError(ctx: Context, name: string, error: Error) {
  const message = `Unknown error ${error.message} during ${name} for ${ctx.request.method} ${ctx.path}`;
  logger.error(message);
  ctx.response.status = 500;
  ctx.response.body = {
    status: "error",
    message,
    error: error.message,
  };
  requestLogger.info({
    message,
    type: "auth",
    kind: "failed",
    status: ctx.response.status.toString(),
    userId: ctx.ip,
  });
}

async function auth_impl(ctx: Context, next: Next, scope?: string[] | string) {
  let token: Token | undefined;
  try {
    const request = new Request(ctx.request);
    const response = new Response();
    token = await ctx.auth.authenticate(request, response, {
      scope,
    });
  } catch (error) {
    if (error instanceof OAuthError) {
      handleOAuthError(ctx, error);
    } else {
      handleNonOAuthError(ctx, "authenticate", error as Error);
    }
    return;
  }

  // if result failed then don't forward
  if (token) {
    // Copy properties to allow overrides
    const user = cloneDeep(token.user);
    const scope = cloneDeep(token.scope);

    // Allow admin to override user id and current session
    if (token.scope?.includes("admin")) {
      // check for override headers
      const overrideUserId = ctx.get("X-Tapi-UserId");
      if (overrideUserId) {
        user.userId = overrideUserId;
      }
      const overrideCurrentSessionId = ctx.get("X-Tapi-CurrentSessionId");
      if (overrideCurrentSessionId) {
        user.currentSessionId = overrideCurrentSessionId;
      }
    }

    ctx.state.auth = {
      scope,
      user,
    };
    return await next();
  }
  return;
}

export function authenticate(scope?: string | string[]) {
  return async (ctx: Context, next: Next) => {
    const _result = await auth_impl(ctx, next, scope);
    // log(`oauth2/koa/authenticate(${scope})`, _result);
  };
}

export function authPaths(paths: PathDef[], scope?: string | string[]) {
  return async (ctx: Context, next: Next) => {
    // only authenticate for the listed paths
    if (pathDefsMatch(ctx, paths)) {
      // auth_impl will forward the request if it matches
      const _result = await auth_impl(ctx, next, scope);
      log(`oauth2/koa/authenticate(${scope})`, _result);
    } else {
      await next();
    }
  };
}

export function authClientUser(paths: PathDef[]) {
  return async (ctx: Context, next: Next) => {
    const {
      user,
      auth: { scope, user: authUser },
    } = ctx.state;

    // log("ctx.request.method:", ctx.request.method);
    // log("ctx._matchedRoute:", ctx._matchedRoute);
    if (pathDefsMatch(ctx, paths)) {
      // log("authOwnerInvite() matches spec");

      if (scope?.includes("admin")) {
        log(`authClientUser() allowing admin auth ${scope}`);
        await next();
        return;
      } else if (authUser.userId !== user.userId) {
        const message = `User '${authUser.userId}' cannot perform this operation on user '${user.id}' because they are not authorized.`;
        logger.error(message);
        ctx.status = 403;
        ctx.body = {
          status: "Forbidden",
          message,
        };
        return;
      }
    }

    await next();
  };
}

export function authSessionOwner(paths: PathDef[]) {
  return async (ctx: Context, next: Next) => {
    const {
      self,
      session,
      auth: { scope },
    } = ctx.state;

    // log("ctx.request.method:", ctx.request.method);
    // log("ctx._matchedRoute:", ctx._matchedRoute);
    if (pathDefsMatch(ctx, paths)) {
      // log("authOwnerInvite() matches spec");

      if (scope?.includes("admin")) {
        log(`authSessionOwner() allowing admin auth ${scope}`);
        await next();
        return;
      } else if (self.id !== session.ownerId) {
        log(
          `authSessionOwner(${ctx.method}, ${ctx._matchedRoute}, ${ctx.path})`,
        );
        const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they are not the owner (name: ${session.name}).`;
        logger.error(message);
        ctx.status = 403;
        ctx.body = {
          status: "Forbidden",
          message,
        };
        return;
      }
    }

    await next();
  };
}

export function authOwnerInvite(paths: PathDef[]) {
  return async (ctx: Context, next: Next) => {
    const {
      self,
      session,
      auth: { scope },
    } = ctx.state;

    // log("ctx.request.method:", ctx.request.method);
    // log("ctx._matchedRoute:", ctx._matchedRoute);
    if (pathDefsMatch(ctx, paths)) {
      // log("authOwnerInvite() matches spec");

      if (scope?.includes("admin")) {
        log(`authOwnerInvite() allowing admin auth ${scope}`);
      } else if (!canViewSession(session, self.id)) {
        const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
        logger.error(message);
        ctx.status = 403;
        ctx.body = {
          status: "Forbidden",
          message,
        };
        return;
      }
    }

    await next();
  };
}

function _authOwnerInvite_2() {
  return async (ctx: Context, next: Next) => {
    const { self, session } = ctx.state;

    if (!canViewSession(session, self.id)) {
      const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
      logger.error(message);
      ctx.status = 403;
      ctx.body = {
        status: "Forbidden",
        message,
      };
      return;
    }

    await next();
  };
}
