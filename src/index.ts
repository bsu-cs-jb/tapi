import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import Koa, { Context } from "koa";
import Router from "@koa/router";
import cors from "@koa/cors";
import { bodyParser } from "@koa/bodyparser";

import model from "./oauth2/SimpleModel.js";
import { authenticate, token } from "./oauth2/koa.js";

import OAuth2Server  from "oauth2-server";

const oauth = new OAuth2Server({
  model,
});

import { graderRoutes } from "./grader.js";
import { indecisiveRoutes } from "./indecisive.js";

import { config } from "./config.js";
import { log, jsonhtml } from "./utils.js";
import { getCat, allCats } from "./db.js";

const app = new Koa();
const router = new Router();

app.context.auth = oauth;

router.use('/admin', authenticate("admin"));
router.use('/test', authenticate("read"));

router
  .get("/", (ctx: Context) => {
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
  })
  .get("/test", async (ctx) => {
    // if (!(await authenticate(ctx, "read"))) {
    //   return;
    // }
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
  })
  .get("/admin", async (ctx) => {
    // if (!(await authenticate(ctx, "admin"))) {
    //   return;
    // }
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
  })
  .post("/auth", async (ctx) => {
    await token(ctx);
  })
  .get("/cats", (ctx) => {
    const cats = allCats();
    log(`Found ${cats.length} cats.`);
    let body = "<!DOCTYPE html>\n<html><body>";
    body += `<p>${cats.length} Cats:<p>\n`;
    for (const cat of allCats()) {
      body += `<p><a href="/cats/${cat.id}">${cat.name} - ${cat.id}</a></p>\n`;
    }
    body += "\n</body></html>";
    ctx.body = body;
  })
  .param("catId", async (id, ctx, next) => {
    ctx.cat = getCat(id);
    await next();
  })
  .get("/cats/:catId", (ctx) => {
    const {
      cat,
      params: { catId },
    } = ctx;
    let body = `<p>Cat id: ${catId}</p>`;

    if (ctx.cat) {
      log(`Found cat "${cat.name}" with id "${cat.id}"`);
      body += jsonhtml(ctx.cat);
    } else {
      log(`Missing cat with id "${catId}"`);
      body += "Couldn't find cat";
    }

    ctx.body = body;
  });

const graderRouter = new Router({
  prefix: "/grader",
});
graderRoutes(graderRouter);

const indecisiveRouter = new Router({
  prefix: "/indecisive",
});
indecisiveRoutes(indecisiveRouter);

app
  .use(cors())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(graderRouter.routes())
  .use(graderRouter.allowedMethods())
  .use(indecisiveRouter.routes())
  .use(indecisiveRouter.allowedMethods());

log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
log(`LOG_LEVEL: ${config.LOG_LEVEL}`);

log(`DB_GRADING_DIR: ${config.DB_GRADING_DIR}`);
log(`DB_GIT_COMMIT: ${config.DB_GIT_COMMIT}`);
log(`DB_GIT_COMMIT_SCRIPT: ${config.DB_GIT_COMMIT_SCRIPT}`);

log(`Listening on port ${config.APP_PORT}`);

app.listen(config.APP_PORT);
