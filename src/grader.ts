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

import { cloneDeep } from 'lodash-es';

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

function refWithId(resource: ResourceDef, id: string):ResourceDef {
  const ref = cloneDeep(resource);
  ref.id = id;
  return ref;
}

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

function resourceFromContext(resource: ResourceDef, id?:string, ctx?:Record<string,string>):ResourceDef {
  const ref = cloneDeep(resource);
  if (id) {
    ref.id = id;
  }
  if (ctx && ref.parents) {
    for (const parent of ref.parents) {
      if (parent.paramName in ctx) {
        parent.id = ctx[parent.paramName];
      }
    }
  }
  return ref;
}

function routerParam(router:Router, resource: ResourceDef):Router {
  return router.param(resource.paramName, async (id, ctx, next) => {
    const ref = resourceFromContext(resource, id, ctx.params);
    ctx[resource.singular] = await readResource(ref);
    if (!ctx[resource.singular]) {
      ctx.status = 404;
      console.error(`${resource.singular} id '${id}' not found.`);
      return;
    }
    await next();
  });
}

function linkList(
  router: Router,
  resource:ResourceDef,
  resources:RestResource[],
  urlParams:Record<string,string> = {}): string
{
  console.log(`linkList(router, ${resource.paramName}, ${resource.singular}, ${resources.length})`);
  let result = '';
  for (const r of resources) {
    const href = router.url(resource.singular, { [resource.paramName]: r.id, ...urlParams });
    console.log(`<p><a href="${href}">${r.name} - ${r.id}</a></p>`);
    result += `<p><a href="${href}">${r.name} - ${r.id}</a></p>\n`;
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

  function getCollection(router: Router, resource:ResourceDef): Router {
    return router.get(resource.name, `/${resource.name}`, async (ctx) => {
      const collection = await getAll(resource);
      log(`Found ${collection?.length} ${resource.name}.`);
      let body = '<!DOCTYPE html>\n<html><body>';
      body += `<p>${collection?.length || 0} ${resource.name}:<p>\n`;
      if (collection) {
        body += linkList(router, resource, collection);
      }
      body += '\n</body></html>';
      ctx.body = body;
    });
  }

  function getResource(
    router: Router,
    resource:ResourceDef,
    subCollections?:ResourceDef[],
  ): Router {
    return router.get(
      resource.singular,
      `/${resource.name}/:${resource.paramName}`,
      async (ctx) => {
        // const { course, params: { courseId } } = ctx;
        const item = ctx[resource.singular];
        let body = '';
        body += `<p><a href="${router.url(resource.name)}">${resource.name}</a></p>`;
        body += `<p>${resource.singular} id: ${item.id}</p>`;
        body += `<p>${resource.singular} name: ${item.name}</p>`;
        if (subCollections) {
          for (const sr of subCollections) {
            body += linkList(router, sr, item[sr.name], { [resource.paramName]: item.id });
          }
        }
        body += jsonhtml(item);
        ctx.body = body;
      });
  }

  function postResource(router: Router, resource: ResourceDef): Router {
    router.post(`/${resource.name}`, async (ctx, next) => {
      const data = ctx.request.body;
      if (!data.id) {
        data.id = urlid();
      }
      let body = `<p>POST ${resource.singular} ${data.id}</p>\n`;
      const ref = refWithId(resource, data.id);
      if (await resourceExists(ref)) {
        body += `<p>${resource.name} with id '${data.id}' already exists. Failing</p>\n`;
        ctx.body = body;
        ctx.status = 400;
        return await next();
      }
      console.log(`${resource.singular} body:`, data);
      const filename = await writeResource(ref, data);
      body += `<p>Written to: ${filename}</p>\n`;
      body += '<p>Body:</p>\n';
      body += jsonhtml(data);
      ctx.body = body;
    });
    return router;
  }

  function putResource(router: Router, resource: ResourceDef): Router {
    return router.put(
      resource.singular,
      `/${resource.name}/:${resource.paramName}`,
      async (ctx) => {
        const data = ctx.request.body;
        const id = ctx.params[resource.paramName];
        if (data.id) {
          assert(data.id === id);
        } else {
          data.id = id;
        }
        let body = `<p>PUT ${resource.singular} ${data.id}</p>\n`;
        const ref = refWithId(resource, data.id);
        console.log(`${resource.singular} body:`, data);
        const filename = await writeResource(ref, data);
        body += `<p>Written to: ${filename}</p>\n`;
        body += '<p>Body:</p>\n';
        body += jsonhtml(data);
        ctx.body = body;
      });
  }

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
