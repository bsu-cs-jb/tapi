import Router from '@koa/router';
import { urlid } from './genid.js';
import { log, jsonhtml, assert } from './utils.js';
import { getCourse, allCourses } from './CourseDb.js';
import { writeResource, readResource, resourceExists } from './FileDb.js';

import { omit } from 'lodash-es';

export function graderRoutes(router: Router) {

  router
    .get('/', async (ctx) => {
      ctx.body = `<p>Nice to meet you, are you looking for my <a href="${router.url('courses')}">Courses</a>?</p>`;
    })
    .get('courses', '/courses', (ctx) => {
      const courses = allCourses();
      log(`Found ${courses.length} courses.`);
      let body = '<!DOCTYPE html>\n<html><body>';
      body += `<p>${courses.length} courses:<p>\n`;
      for (const course of allCourses()) {
        body += `<p><a href="${router.url('course', { courseId: course.id })}">${course.name} - ${course.id}</a></p>\n`;
      }
      body += '\n</body></html>';
      ctx.body = body;
    })
    .param('courseId', async (id, ctx, next) => {
      ctx.course = getCourse(id);
      if (!ctx.course) {
        ctx.status = 404;
        console.error(`Course id '${id}' not found.`);
        return;
      }
      await next();
    })
    .param('rubricId', async (id, ctx, next) => {
      ctx.rubric = await readResource('rubrics', id);
      if (!ctx.rubric) {
        ctx.status = 404;
        console.error(`Rubric '${id}' not found on Course '${ctx.course.id}'.`);
        return;
      }
      // ctx.rubric = findRubric(ctx.course, id);
      // Could check if rubric exists in course also
      await next();
    })
    .post('/courses', async (ctx, next) => {
      // const { course, params: { courseId } } = ctx;
      const data = ctx.request.body;
      if (!data.id) {
        data.id = urlid();
      }
      let body = `<p>PUT Course ${data.id}</p>\n`;
      if (await resourceExists('courses', data.id)) {
        body += `<p>Course with id '${data.id}' already exists. Failing</p>\n`;
        ctx.body = body;
        ctx.status = 400;
        return await next();
      }
      console.log('Course body:', data);
      const filename = await writeResource('courses', data);
      body += `<p>Written to: ${filename}</p>\n`;
      body += '<p>Body:</p>\n';
      body += jsonhtml(data);
      ctx.body = body;
    })
    .put('course', '/courses/:courseId', async (ctx) => {
      const { params: { courseId } } = ctx;
      const data = ctx.request.body;
      console.log('Course body:', data);
      assert(courseId === data.id);
      const filename = await writeResource('courses', data);
      let body = `<p>PUT Course ${courseId}</p>\n`;
      body += `<p>Written to: ${filename}</p>\n`;
      body += '<p>Body:</p>\n';
      body += jsonhtml(data);
      ctx.body = body;
    })
    .get('course', '/courses/:courseId', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      // const filename = await writeResource('courses', course);
      let body = `<p>Course id: ${courseId}</p>`;
      body += '<p>';
      for (const student of course.students) {
        body += `${student.name} - ${student.id}<br/>`;
      }
      body += '</p>';
      body += '<p>';
      for (const rubric of course.rubrics) {
        body += `<a href="${router.url('rubric', { courseId, rubricId: rubric.id})}">${rubric.name} - ${rubric.id}</a><br/>`;
      }
      body += '</p>';
      body += jsonhtml(omit(course, ['rubrics','gradebook']));
      ctx.body = body;
    })
    .get('rubrics', '/courses/:courseId/rubrics', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course name: ${course.name}</p>`;
      body += jsonhtml(course.rubrics);
      ctx.body = body;
    })
    .get('rubric', '/courses/:courseId/rubrics/:rubricId', async (ctx) => {
      const { course, rubric } = ctx;
      // const filename = await writeResource('rubrics', rubric);
      // const data = await readResource('rubrics', rubric.id);
      let body = '';
      body += `<p>Course: ${course.name}</p>`;
      body += `<p>Rubric: ${rubric.name}</p>`;
      // body += `<p>Wrote to ${filename}</p>`;
      body += jsonhtml(rubric);
      // console.log(`GET /courses/:courseId/rubrics/:rubricId`);
      ctx.body = body;
      return ctx;
    });

}
