import { Context, Next } from "koa";
import { Request, Response, OAuthError } from "oauth2-server";
import { log, logger } from "../logging.js";
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

function oauthResponse(ctx: Context, response: Response) {
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
}

function oauthError(ctx: Context, error: OAuthError) {
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
}

export async function token(ctx: Context) {
  const response = new Response();
  try {
    const request = new Request(ctx.request);
    const result = await ctx.auth.token(request, response);
    oauthResponse(ctx, response);
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
      const err = error as Error;
      logger.error(`Non-OAuthError: ${err.message}`);
      ctx.response.status = 500;
      ctx.response.body = {
        status: "error",
        message: "Unexpected error during authentication",
        error: err.message,
      };
    }
    return;
  }
}

async function auth_impl(ctx: Context, next: Next, scope?: string[] | string) {
  try {
    const request = new Request(ctx.request);
    const response = new Response();
    const result = await ctx.auth.authenticate(request, response, {
      scope,
    });
    // if result failed then don't forward
    if (result) {
      ctx.state.auth = {
        scope: result.scope,
        user: result.user,
      };
      await next();
      return result;
    } else {
      return;
    }
  } catch (error) {
    if (error instanceof OAuthError) {
      oauthError(ctx, error);
    } else {
      const err = error as Error;
      logger.error(`Non-OAuthError: ${err.message}`);
      ctx.response.status = 500;
      ctx.response.body = {
        status: "error",
        message: "Unexpected error during authentication",
        error: err.message,
      };
    }
    return null;
  }
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
