import Koa from 'koa';
import Router from '@koa/router';
// const Koa = require('koa');
// const Router = require

const app = new Koa();
const router = new Router();

router.get('/', (ctx, next) => {
  // ctx.router
});

app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
