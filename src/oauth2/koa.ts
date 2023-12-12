import { Context, Next } from "koa";
import { Request, Response, OAuthError } from "oauth2-server";
import { log, logger } from "../logging.js";

function oauthResponse(ctx: Context, response: Response) {
  ctx.response.status = response.status || 500;
  ctx.response.body = response.body;
  for (const header in response.headers) {
    ctx.response.set(header, response.get(header));
  }
}

function oauthError(ctx: Context, error: OAuthError) {
  logger.error(`OAuthError authenticating ${error.code} ${error.name} ${error.message}`, {
    code: error.code,
    name: error.name,
    message: error.message,
    request: {
      ip: ctx.request.ip,
      headers: ctx.request.headers,
      body: ctx.request.body,
    },
  });
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
    }
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
