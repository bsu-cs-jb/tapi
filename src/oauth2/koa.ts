import { Context, Next } from "koa";
import { Request, Response, OAuthError } from "oauth2-server";
import { logger } from "../logging.js";

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

async function auth_impl(ctx: Context, scope?: string[] | string) {
  try {
    const request = new Request(ctx.request);
    const response = new Response();
    const result = await ctx.auth.authenticate(request, response, {
      scope,
    });
    return result;
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
    const result = await auth_impl(ctx, scope);
    // log(`oauth2/koa/authenticate(${scope})`, result);

    // if result failed then don't forward
    if (result) {
      ctx.state.auth = {
        scope: result.scope,
        user: result.user,
      };
      await next();
    }
  };
}
