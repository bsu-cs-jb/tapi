import Router from '@koa/router';
import { jsonhtml } from './utils.js';
import {
  ResourceDef,
} from './FileDb.js';
import {
  routerParam,
  linkList,
  getCollection,
  getResource,
  putResource,
  postResource,
} from './RestAPI.js';

const COURSE:ResourceDef = {
  name: 'courses',
  singular: 'course',
  paramName: 'courseId',
};

const RUBRIC:ResourceDef = {
  name: 'rubrics',
  singular: 'rubric',
  paramName: 'rubricId',
  // parents: [COURSE],
};

const STUDENT:ResourceDef = {
  name: 'students',
  singular: 'student',
  paramName: 'studentId',
  // parents: [COURSE],
};

const GRADE:ResourceDef = {
  name: 'grades',
  singular: 'grade',
  paramName: 'gradeId',
  // parents: [COURSE, STUDENT],
};

// function courseRef(courseId: string):ResourceDef {
//   const ref = cloneDeep(COURSE);
//   ref.id = courseId;
//   return ref;
// }
//
// function rubricRef(courseId: string, rubricId:string):ResourceDef {
//   const ref = cloneDeep(RUBRIC);
//   ref.id = rubricId;
//   ref.parents = [courseRef(courseId)];
//   return ref;
// }
//
// function studentRef(courseId: string, studentId: string):ResourceDef {
//   const ref = cloneDeep(STUDENT);
//   ref.id = studentId;
//   ref.parents = [courseRef(courseId)];
//   return ref;
// }

export function graderRoutes(router: Router) {

  router.get('/', async (ctx) => {
    ctx.body = `<p>Nice to meet you, are you looking for my <a href="${router.url('courses')}">Courses</a>?</p>`;
  });

  routerParam(router, COURSE);
  routerParam(router, RUBRIC);
  routerParam(router, STUDENT);

  getCollection(router, COURSE);
  getResource(router, COURSE, [RUBRIC, STUDENT]);
  postResource(router, COURSE);
  putResource(router, COURSE);

  getCollection(router, STUDENT);
  getResource(router, STUDENT, [GRADE]);
  postResource(router, STUDENT);
  putResource(router, STUDENT);

  [RUBRIC, GRADE].forEach((resource) => {
    getCollection(router, resource);
    getResource(router, resource);
    postResource(router, resource);
    putResource(router, resource);
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
