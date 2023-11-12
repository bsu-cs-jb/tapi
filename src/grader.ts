import Router from '@koa/router';
import { urlid } from './genid.js';
import { log, jsonhtml, assert } from './utils.js';
import {
  getAll,
  writeResource,
  readResource,
  ResourceDef,
  resourceExists,
} from './FileDb.js';
import type { RestResource } from './FileDb.js';

// import { omit } from 'lodash-es';

function courseRef(id?:string):ResourceDef {
  return {
    id,
    resource: 'courses',
    singular: 'course',
    paramName: 'courseId',
  };
}

const COURSE = courseRef();
const RUBRIC = {
  resource: 'rubrics',
  singular: 'rubric',
  paramName: 'rubricId',
  parents: [COURSE],
};
const STUDENT = {
  resource: 'students',
  singular: 'student',
  paramName: 'studentId',
  parents: [COURSE],
};

function routerParam(router:Router, resource: ResourceDef):Router {
  return router.param(resource.paramName, async (id, ctx, next) => {
    ctx[resource.singular] = await readResource(resource.resource, id);
    if (!ctx[resource.singular]) {
      ctx.status = 404;
      console.error(`${resource.singular} id '${id}' not found.`);
      return;
    }
    await next();
  });
}

function linkList(router: Router, resource:ResourceDef, resources:RestResource[], urlParams:Record<string,string>={}):string {
  console.log(`linkList(router, ${resource.paramName}, ${resource.singular}, ${resources.length})`);
  let result = '';
  for (const r of resources) {
    console.log(`<p><a href="${router.url(resource.singular, { [resource.paramName]: r.id, ...urlParams })}">${r.name} - ${r.id}</a></p>`);
    result += `<p><a href="${router.url(resource.singular, { [resource.paramName]: r.id, ...urlParams })}">${r.name} - ${r.id}</a></p>\n`;
  }
  return result;
}

export function graderRoutes(router: Router) {

  router.get('/', async (ctx) => {
    ctx.body = `<p>Nice to meet you, are you looking for my <a href="${router.url('courses')}">Courses</a>?</p>`;
  });

  routerParam(router, COURSE);
  routerParam(router, RUBRIC);
  routerParam(router, STUDENT);

  // router
  //   .param('courseId', async (id, ctx, next) => {
  //     // ctx.course = getCourse(id);
  //     ctx.course = await readResource('courses', id);
  //     if (!ctx.course) {
  //       ctx.status = 404;
  //       console.error(`Course id '${id}' not found.`);
  //       return;
  //     }
  //     await next();
  //   })
  //   .param('rubricId', async (id, ctx, next) => {
  //     ctx.rubric = await readResource('rubrics', id);
  //     if (!ctx.rubric) {
  //       ctx.status = 404;
  //       console.error(`Rubric '${id}' not found on Course '${ctx.course.id}'.`);
  //       return;
  //     }
  //     // ctx.rubric = findRubric(ctx.course, id);
  //     // Could check if rubric exists in course also
  //     await next();
  //   });

  router
    .get('courses', '/courses', async (ctx) => {
      // const courses = allCourses();
      const courses = await getAll('courses');
      log(`Found ${courses?.length} courses.`);
      let body = '<!DOCTYPE html>\n<html><body>';
      body += `<p>${courses?.length} courses:<p>\n`;
      if (courses) {
        body += linkList(router, COURSE, courses);
      }
      body += '\n</body></html>';
      ctx.body = body;
    });

  router
    .post('/courses', async (ctx, next) => {
      // const { course, params: { courseId } } = ctx;
      const data = ctx.request.body;
      if (!data.id) {
        data.id = urlid();
      }
      let body = `<p>POST Course ${data.id}</p>\n`;
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
      let body = '';
      body += `<p><a href="${router.url('courses')}">Courses</a></p>`;
      body += `<p>Course id: ${courseId}</p>`;
      body += linkList(router, STUDENT, course.students, { courseId });
      body += '<p>';
      body += linkList(router, RUBRIC, course.rubrics, { courseId });
      body += '</p>';
      // body += jsonhtml(omit(course, ['rubrics','gradebook']));
      body += jsonhtml(course);
      ctx.body = body;
    });

  router
    .get('rubrics', '/courses/:courseId/rubrics', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course: <a href="${router.url('course', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += linkList(router, RUBRIC, course.rubrics, { courseId });
      body += jsonhtml(course.rubrics);
      ctx.body = body;
    })
    .get('rubric', '/courses/:courseId/rubrics/:rubricId', async (ctx) => {
      const { course, rubric } = ctx;
      let body = '';
      body += `<p>Course: <a href="${router.url('course', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += `<p>Rubric: ${rubric.name}</p>`;
      body += jsonhtml(rubric);
      ctx.body = body;
      return ctx;
    });

  router
    .get('students', '/courses/:courseId/students', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course: <a href="${router.url('course', { courseId: course.id })}">${course.name}</a></p>\n`;
      // body += linkList(router, 'studentId', 'student', course.students);
      body += linkList(router, STUDENT, course.students, { courseId });
      body += jsonhtml(course.students);
      ctx.body = body;
    })
    .get('student', '/courses/:courseId/students/:studentId', async (ctx) => {
      const { course, student } = ctx;
      let body = '';
      body += `<p>Course: <a href="${router.url('course', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += `<p>Student: <a href="${router.url('student', { courseId: course.id, studentId: student.id })}">${student.name}</a></p>\n`;
      body += jsonhtml(student);
      ctx.body = body;
      return ctx;
    });

}
