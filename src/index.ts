import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import { bodyParser } from '@koa/bodyparser';

import { APP_PORT } from './config';
import { log, jsonhtml } from './utils';
import { getCat, allCats } from './db';

const app = new Koa();
const router = new Router();

router
  .get('/', (ctx, next) => {
    // ctx.router
    ctx.body = 'Nice to meet you';
  })
  .get('/cats', (ctx, next) => {
    const cats = allCats();
    log(`Found ${cats.length} cats.`);
    let body = `<p>${cats.length} Cats:<p>\n`
    for (const cat of allCats()) {
      body += `<p>${cat.id}</p>`;
    }
    ctx.body = body;
  })
  .param('catId', (id, ctx, next) => {
    ctx.cat = getCat(id);
    next();
  })
  .get('/cats/:catId', (ctx, next) => {
    const { cat, params: { catId } } = ctx;
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

app
  .use(cors())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

log(`Listening on port ${APP_PORT}`);

app.listen(APP_PORT);
