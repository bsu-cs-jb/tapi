import { Context, Next } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import {
  getCollection,
  getResource,
  postResource,
  patchResource,
  routerParam,
} from "./RestAPI.js";
import {
  AuthDb,
  CLIENT,
  deleteToken,
  fetchTokens,
  isInvalid,
  TOKEN,
  TokenDb,
} from "./AuthDb.js";
import { log } from "./utils.js";
import { hash } from "./hash.js";

async function preUpdateClient(
  ctx: Context,
  dbAuth: AuthDb,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  body: any,
): Promise<AuthDb> {
  log("preUpdateClient()", dbAuth);
  const clientId = dbAuth.client?.id || dbAuth.user?.userId || dbAuth.id;
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
    let body = "";
    const tokens = await fetchTokens();
    const deletedTokens: TokenDb[] = [];

    body +=
      "<!DOCTYPE html>\n<html><head><title>Cleaned Tokens</title></head><body>";
    body += "<div><p>Deleted Tokens</p><ul>\n";
    for (const token of tokens) {
      if (await isInvalid(token)) {
        deletedTokens.push(token);
        deleteToken(token.id);
        body += `<li>${token.id} - ${token.name}</li>\n`;
      }
    }
    body += "</ul></div>\n";

    ctx.body = body;
    await next();
  });

  getCollection(router, CLIENT);
  getResource(router, CLIENT);
  getCollection(router, TOKEN);
  getResource(router, TOKEN);

  postResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
  patchResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
}
