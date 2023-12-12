import { Context, Next } from "koa";
import { Request, Response, OAuthError } from "oauth2-server";
import { log } from "../logging.js";

function oauthResponse(ctx: Context, response: Response) {
  ctx.response.status = response.status || 500;
  ctx.response.body = response.body;
  for (const header in response.headers) {
    ctx.response.set(header, response.get(header));
  }
}

function oauthError(ctx: Context, error: OAuthError) {
  ctx.response.status = error.code || 500;
  ctx.response.body = {
    error: error.name,
    error_description: error.message,
  };
}

export async function token(ctx: Context) {
  const request = new Request(ctx.request);
  const response = new Response();
  try {
    const result = await ctx.auth.token(request, response);
    oauthResponse(ctx, response);
    return result;
  } catch (error) {
    if (error instanceof OAuthError) {
      oauthResponse(ctx, response);
    }
  }
}

async function auth_impl(ctx: Context, scope?: string[] | string) {
  const request = new Request(ctx.request);
  const response = new Response();
  try {
    const result = await ctx.auth.authenticate(request, response, {
      scope,
    });
    return result;
  } catch (error) {
    if (error instanceof OAuthError) {
      log("error is OAuthError", {
        code: error.code,
        name: error.name,
        message: error.message,
      });
      log("response:", response);
      oauthError(ctx, error);
    }
    return null;
  }
}

export function authenticate(scope?: string | string[]) {
  return async (ctx: Context, next: Next) => {
    const result = await auth_impl(ctx, scope);
    console.log(`oauth2/koa/authenticate(${scope})`, result);

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
