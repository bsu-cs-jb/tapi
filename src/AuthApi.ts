import { Context, Next } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import { authenticate } from "./oauth2/koa.js";
import {
  getCollection,
  getResource,
  deleteResource,
  postResource,
  patchResource,
  routerParam,
} from "./RestAPI.js";
import { AuthDb, CLIENT, immediatePurgeTokens, TOKEN } from "./AuthDb.js";
import { log } from "./utils/logging.js";
import { hash } from "./utils/hash.js";

async function preUpdateClient(
  ctx: Context,
  dbAuth: AuthDb,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  body: any,
): Promise<AuthDb> {
  // log(`preUpdateClient(${ctx.request.method})`, dbAuth, body);
  const clientIdParam =
    "clientId" in ctx.params ? ctx.params["clientId"] : undefined;
  const clientId =
    clientIdParam || body?.client?.id || body?.user?.userId || body?.id;
  dbAuth.id = clientId;
  dbAuth.client.id = clientId;
  dbAuth.user.userId = clientId;
  if (!dbAuth.name) {
    dbAuth.name = `Auth for ${clientId}`;
  }
  if (body.secret !== undefined) {
    dbAuth.secret = hash(dbAuth.secret);
    log(`Updating clientSecret: ${dbAuth.secret}`);
  }
  return dbAuth;
}

export function authRoutes(router: Router) {
  routerParam(router, CLIENT);
  routerParam(router, TOKEN);

  router.get("/", async (ctx: Context, next: Next) => {
    let body = "";
    body +=
      "<!DOCTYPE html>\n<html><head><title>Auth Root</title></head><body>";
    body += "<div><p>Auth</p><ul>\n";
    [CLIENT, TOKEN].forEach((resource) => {
      body += `<li>${_.capitalize(resource.name)}: <a href="${router.url(
        resource.name + "-html",
      )}">html</a> <a href="${router.url(resource.name)}">json</a></li>\n`;
    });
    body += "</ul></div>\n";
    body += "<div><p>Other links</p><ul>\n";
    body += '<li><a href="/auth/clean-tokens">Clean Tokens</a></li>\n';
    body += "</ul></div>\n";

    ctx.body = body;
    await next();
  });

  router.get("/clean-tokens", async (ctx: Context, next: Next) => {
    const deletedTokens = await immediatePurgeTokens();

    const contentType = ctx.accepts("json", "html");

    if (contentType === "json") {
      ctx.body = deletedTokens;
    } else {
      let body = "";
      body +=
        "<!DOCTYPE html>\n<html><head><title>Cleaned Tokens</title></head><body>";
      body += "<div><p>Deleted Tokens</p><ul>\n";
      for (const token of deletedTokens) {
        body += `<li>${token.id} - ${token.name}</li>\n`;
      }
      body += "</ul></div>\n";
      ctx.body = body;
    }

    await next();
  });

  router.use(["/clients(.*)", "/tokens(.*)"], authenticate("admin"));

  // router.use(["/clients", "/tokens"], authPaths([
  // ], "admin"));

  getCollection(router, CLIENT);
  getResource(router, CLIENT);
  deleteResource(router, CLIENT);
  getCollection(router, TOKEN);
  getResource(router, TOKEN);
  deleteResource(router, TOKEN);

  postResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
  patchResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
}
