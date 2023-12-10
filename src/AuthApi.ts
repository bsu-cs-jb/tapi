import { Context, Next } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import {
  deleteResource,
  getCollection,
  getResource,
  postResource,
  putResource,
  patchResource,
  routerParam,
} from "./RestAPI.js";
import {
  CLIENT,
  TOKEN,
  AuthDb,
  FileModelToken,
  FileModelUser,
  fetchClient,
  fetchToken,
  writeToken,
} from "./AuthDb.js";
import { authenticate } from "./oauth2/koa.js";
import { log } from "./utils.js";
import { hash } from "./hash.js";

async function preUpdateClient(ctx: Context, dbAuth: AuthDb): Promise<AuthDb> {
  log("preUpdateClient()");
  const clientId = dbAuth.client?.id || dbAuth.user?.userId || dbAuth.id;
  dbAuth.id = clientId;
  dbAuth.client.id = clientId;
  dbAuth.user.userId = clientId;
  if (!dbAuth.name) {
    dbAuth.name = `Auth for ${clientId}`;
  }
  if (dbAuth.secret) {
    dbAuth.secret = hash(dbAuth.secret);
  }
  return dbAuth;
}

export function authRoutes(router: Router) {
  routerParam(router, CLIENT);
  routerParam(router, TOKEN);

  router.get("/", async (ctx) => {
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
    body += '<li><a href="http://google.com">Google</a></li>\n';
    body += "</ul></div>\n";
    ctx.body = body;
  });

  getCollection(router, CLIENT);
  getCollection(router, TOKEN);

  postResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
  patchResource<AuthDb>(router, CLIENT, {
    preProcess: preUpdateClient,
  });
}
