import Router from '@koa/router';
import { log, jsonhtml } from './utils.js';
import { getCat, allCats } from './db.js';

export function graderRoutes(router: Router) {

  const ROOT = '/grader';

  router
    .get(ROOT, (ctx, next) => {
      ctx.body = `<p>Nice to meet you, are you looking for my <a href="${ROOT}/students">Students</a>?</p>`;
    })
    .get(`${ROOT}/students`, (ctx, next) => {
      const students = allCats();
      log(`Found ${students.length} students.`);
      let body = `<!DOCTYPE html>\n<html><body>`;
      body += `<p>${students.length} students:<p>\n`
      for (const cat of allCats()) {
        body += `<p><a href="${ROOT}/students/${cat.id}">${cat.name} - ${cat.id}</a></p>\n`;
      }
      body += '\n</body></html>';
      ctx.body = body;
    })
    .param('studentId', (id, ctx, next) => {
      ctx.cat = getCat(id);
      next();
    })
    .get(`${ROOT}/students/:studentId`, (ctx, next) => {
      const { cat, params: { studentId } } = ctx;
      let body = `<p>Student id: ${studentId}</p>`;
      ctx.body = body;
    });

}
