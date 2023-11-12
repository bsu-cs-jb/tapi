import Router from '@koa/router';
import { log, jsonhtml } from './utils.js';
import { getCourse, allCourses } from './CourseDb.js';
import { writeResource } from "./FileDb.js";

import { findRubric } from "grading";
import { omit } from "lodash-es";

export function graderRoutes(router: Router) {

  const ROOT = "/grader";

  router
    .get('/', (ctx, next) => {
      ctx.body = `<p>Nice to meet you, are you looking for my <a href="${router.url('courses')}">Courses</a>?</p>`;
    })
    .get('courses', `/courses`, (ctx, next) => {
      const courses = allCourses();
      log(`Found ${courses.length} courses.`);
      let body = `<!DOCTYPE html>\n<html><body>`;
      body += `<p>${courses.length} courses:<p>\n`
      for (const course of allCourses()) {
        body += `<p><a href="${router.url('course', { courseId: course.id })}">${course.name} - ${course.id}</a></p>\n`;
      }
      body += '\n</body></html>';
      ctx.body = body;
    })
    .param('courseId', (id, ctx, next) => {
      ctx.course = getCourse(id);
      next();
    })
    .param('rubricId', (id, ctx, next) => {
      ctx.rubric = findRubric(ctx.course, id);
      next();
    })
    .get('course', `/courses/:courseId`, (ctx, next) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += "<p>";
      for (const student of course.students) {
        body += `${student.name} - ${student.id}<br/>`;
      }
      body += "</p>";
      body += "<p>";
      for (const rubric of course.rubrics) {
        body += `<a href="${router.url('rubric', { courseId, rubricId: rubric.id})}">${rubric.name} - ${rubric.id}</a><br/>`;
      }
      body += "</p>";
      body += jsonhtml(omit(course, ['rubrics','gradebook']));
      ctx.body = body;
    })
    .get('rubrics', `/courses/:courseId/rubrics`, (ctx, next) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course name: ${course.name}</p>`;
      body += jsonhtml(course.rubrics);
      ctx.body = body;
    })
    .get('rubric', `/courses/:courseId/rubrics/:rubricId`, async (ctx) => {
      const { course, rubric } = ctx;
      // const filename = await writeDb(`rubrics/${rubric.id}`, rubric);
      const filename = await writeResource('rubrics', rubric);
      let body = '';
      body += `<p>Course: ${course.name}</p>`;
      body += `<p>Rubric: ${rubric.name}</p>`;
      body += `<p>Wrote to ${filename}</p>`;
      body += jsonhtml(rubric);
      console.log(`GET /courses/:courseId/rubrics/:rubricId`);
      ctx.body = body;
    });

}
