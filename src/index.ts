import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import Koa, { Context, Next } from "koa";
import Router from "@koa/router";
import cors from "@koa/cors";
import { bodyParser } from "@koa/bodyparser";

import ratelimit from "koa-ratelimit";
import serve from "koa-static";
import mount from "koa-mount";

import OAuth2Server from "oauth2-server";

import { SimpleModel } from "./oauth2/SimpleModel.js";
import { FileModel } from "./oauth2/FileModel.js";
import { authenticate, token } from "./oauth2/koa.js";

const fileAuth = true;

const authModel = fileAuth ? FileModel() : SimpleModel();

const oauth = new OAuth2Server({
  model: authModel,
});

import { graderRoutes } from "./grader.js";
import { indecisiveRoutes } from "./indecisive.js";
import { authRoutes } from "./AuthApi.js";

import { config } from "./config.js";
import { jsonhtml } from "./utils/json.js";
import { log } from "./utils/logging.js";
import { getCat, allCats } from "./db.js";

const app = new Koa();
const router = new Router();

app.context.auth = oauth;
app.context.authModel = authModel;

// router.use(async (ctx: Context, next: Next) => {
//   log(`Request origin: ${ctx.origin}.`);
//   await next();
// });
//
// router.options("/token", async (ctx: Context, _next: Next) => {
//   log(`OPTIONS origin: ${ctx.origin}.`);
//   if (ctx.origin.match(/bsu-cs-jb\.github\.io/)) {
//     ctx.set("Access-Control-Allow-Origin",ctx.origin);
//     ctx.set("Access-Control-Allow-Methods","POST, GET, OPTIONS, DELETE, PUT, PATCH");
//     ctx.set("Access-Control-Max-Age","86400");
//   }
//   ctx.status = 204
//   //await next();
// });

// apply rate limit
const db = new Map();

function ratelimitWhitelist(ctx: Context): boolean {
  if (config.RATELIMIT_SECRET && config.RATELIMIT_SECRET.length > 5) {
    return ctx.get("X-RateLimit-Bypass") === config.RATELIMIT_SECRET;
  }
  return false;
}

app.use(
  ratelimit({
    driver: "memory",
    db: db,
    duration: config.RATELIMIT_DURATION,
    errorMessage: `Rate limit of ${config.RATELIMIT_MAX} messages in ${
      config.RATELIMIT_DURATION / 1000
    } seconds exceeded. Check for loops and wait for the limit to reset in 1 minute.`,
    id: (ctx) => ctx.ip,
    headers: {
      remaining: "Rate-Limit-Remaining",
      reset: "Rate-Limit-Reset",
      total: "Rate-Limit-Total",
    },
    max: config.RATELIMIT_MAX,
    disableHeader: false,
    whitelist: ratelimitWhitelist,
  }),
);

// Another option during development would be koa-proxy
app.use(mount("/app", serve("./grader/build")));

router.use("/admin", authenticate("admin"));
router.use("/test", authenticate("read"));

router
  .get("/", async (ctx: Context, next: Next) => {
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
    await next();
  })
  .get("/test", async (ctx: Context, next: Next) => {
    // if (!(await authenticate(ctx, "read"))) {
    //   return;
    // }
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
    await next();
  })
  .get("/admin", async (ctx: Context, next: Next) => {
    // if (!(await authenticate(ctx, "admin"))) {
    //   return;
    // }
    ctx.body =
      '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a> or <a href="/grader">Grader</a>?</p>';
    await next();
  })
  .post("/token", async (ctx: Context, next: Next) => {
    await token(ctx);
    await next();
  })
  .get("/cats", async (ctx: Context, next: Next) => {
    const cats = allCats();
    log(`Found ${cats.length} cats.`);
    let body = "<!DOCTYPE html>\n<html><body>";
    body += `<p>${cats.length} Cats:<p>\n`;
    for (const cat of allCats()) {
      body += `<p><a href="/cats/${cat.id}">${cat.name} - ${cat.id}</a></p>\n`;
    }
    body += "\n</body></html>";
    ctx.body = body;
    await next();
  })
  .param("catId", async (id, ctx, next) => {
    ctx.cat = getCat(id);
    await next();
  })
  .get("/cats/:catId", async (ctx: Context, next: Next) => {
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
    await next();
  });

const graderRouter = new Router({
  prefix: "/grader",
});
graderRoutes(graderRouter);

const indecisiveRouter = new Router({
  prefix: "/indecisive",
});
indecisiveRoutes(indecisiveRouter);

const authRouter = new Router({
  prefix: "/auth",
});
authRoutes(authRouter);

app
  .use(cors())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(graderRouter.routes())
  .use(graderRouter.allowedMethods())
  .use(indecisiveRouter.routes())
  .use(indecisiveRouter.allowedMethods())
  .use(authRouter.routes())
  .use(authRouter.allowedMethods());

log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
log(`LOG_LEVEL: ${config.LOG_LEVEL}`);

log(`DB_GRADING_DIR: ${config.DB_GRADING_DIR}`);
log(`DB_INDECISIVE_DIR: ${config.DB_INDECISIVE_DIR}`);
log(`DB_GIT_COMMIT: ${config.DB_GIT_COMMIT}`);
log(`DB_GIT_COMMIT_SCRIPT: ${config.DB_GIT_COMMIT_SCRIPT}`);

log(`INDECISIVE_AUTH: ${config.INDECISIVE_AUTH}`);
log(`GRADER_AUTH: ${config.GRADER_AUTH}`);

log(
  `TOKEN_EXPIRE_MS: ${config.TOKEN_EXPIRE_MS} (${(
    config.TOKEN_EXPIRE_MS /
    1000 /
    60
  ).toFixed(0)} min)`,
);

log(`Listening on port ${config.APP_PORT}`);

app.listen(config.APP_PORT);
