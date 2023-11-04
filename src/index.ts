import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import { bodyParser } from '@koa/bodyparser';

import { config } from './config';
import { log, jsonhtml } from './utils';
import { getCat, allCats } from './db';

const app = new Koa();
const router = new Router();

router
  .get('/', (ctx, next) => {
    // ctx.router
    ctx.body = '<p>Nice to meet you, are you looking for my <a href="/cats">Cats</a>?</p>';
  })
  .get('/cats', (ctx, next) => {
    const cats = allCats();
    log(`Found ${cats.length} cats.`);
    let body = `<!DOCTYPE html>\n<html><body>`;
    body += `<p>${cats.length} Cats:<p>\n`
    for (const cat of allCats()) {
      body += `<p><a href="/cats/${cat.id}">${cat.name} - ${cat.id}</a></p>\n`;
    }
    body += '\n</body></html>';
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

log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
log(`LOG_LEVEL: ${config.LOG_LEVEL}`);
log(`Listening on port ${config.APP_PORT}`);

app.listen(config.APP_PORT);
