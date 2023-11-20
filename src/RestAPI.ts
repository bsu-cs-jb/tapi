import Router from '@koa/router';
import { urlid } from './genid.js';
import { log, jsonhtml, assert } from './utils.js';
import {
  getAll,
  writeResource,
  readResource,
  ResourceDef,
  resourceExists,
  IdResource,
  refWithId,
} from './FileDb.js';
import { cloneDeep } from 'lodash-es';

type IdName = { id: string; name: string; };

export function resourceFromContext(resource: ResourceDef, id?:string, ctx?:Record<string,string>):ResourceDef {
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

export function routerParam<T extends IdResource>(router:Router, resource: ResourceDef):Router {
  return router.param(resource.paramName, async (id, ctx, next) => {
    const ref = resourceFromContext(resource, id, ctx.params);
    ctx[resource.singular] = await readResource<T>(ref);
    if (!ctx[resource.singular]) {
      ctx.status = 404;
      console.error(`${resource.singular} id '${id}' not found.`);
      return;
    }
    await next();
  });
}

export function linkList(
  router: Router,
  resource: ResourceDef,
  resources: IdName[],
  urlParams: Record<string,string> = {}): string
{
  // console.log(`linkList(router, ${resource.paramName}, ${resource.singular}, ${resources.length})`);
  let result = '';
  for (const r of resources) {
    const href = router.url(`${resource.singular}-html`, { [resource.paramName]: r.id, ...urlParams });
    // console.log(`<p><a href="${href}">${r.name} - ${r.id}</a></p>`);
    result += `<p><a href="${href}">${r.name} - ${r.id}</a></p>\n`;
  }
  return result;
}

export function getCollection(router: Router, resource:ResourceDef): Router {
  return router
    .get(`${resource.name}-html`, `/${resource.name}.html`, async (ctx) => {
      const collection = await getAll(resource);
      log(`Found ${collection?.length} ${resource.name}.`);
      let body = '<!DOCTYPE html>\n<html><body>';
      body += `<p>${collection?.length || 0} ${resource.name}:<p>\n`;
      if (collection) {
        body += linkList(router, resource, collection);
      }
      body += '\n</body></html>';
      ctx.body = body;
    })
    .get(resource.name, `/${resource.name}`, async (ctx) => {
      const collection = await getAll(resource);
      // ctx.body = JSON.stringify(collection);
      ctx.body = collection;
    });
}

export function getResource(
  router: Router,
  resource:ResourceDef,
  subCollections?:ResourceDef[],
): Router {
  return router
    .get(
      `${resource.singular}-html`,
      `/${resource.name}/:${resource.paramName}.html`,
      async (ctx) => {
        // const { course, params: { courseId } } = ctx;
        const item = ctx[resource.singular];
        let body = '';
        body += `<p><a href="${router.url(resource.name+'-html')}">${resource.name}</a></p>`;
        body += `<p>${resource.singular} id: ${item.id}</p>`;
        body += `<p>${resource.singular} name: ${item.name}</p>`;
        if (subCollections) {
          for (const sr of subCollections) {
            body += linkList(router, sr, item[sr.name], { [resource.paramName]: item.id });
          }
        }
        body += jsonhtml(item);
        ctx.body = body;
      })
    .get(
      resource.singular,
      `/${resource.name}/:${resource.paramName}`,
      async (ctx) => {
        // const { course, params: { courseId } } = ctx;
        const item = ctx[resource.singular];
        ctx.body = item;
      });
}

export function postResource(router: Router, resource: ResourceDef): Router {
  router.post(`/${resource.name}`, async (ctx, next) => {
    const data = ctx.request.body;
    if (!data.id) {
      data.id = urlid();
    }
    const ref = refWithId(resource, data.id);
    if (await resourceExists(ref)) {
      ctx.body = `<p>${resource.name} with id '${data.id}' already exists. Failing</p>\n`;
      ctx.status = 400;
      return await next();
    }
    const filename = await writeResource(ref, data);
    console.log(`Written to ${filename} ${resource.singular} body:`, data);
    // let body = `<p>POST ${resource.singular} ${data.id}</p>\n`;
    // body += `<p>Written to: ${filename}</p>\n`;
    // body += '<p>Body:</p>\n';
    // body += jsonhtml(data);
    ctx.body = data;
  });
  return router;
}

export function putResource(router: Router, resource: ResourceDef): Router {
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
      const ref = refWithId(resource, data.id);
      const filename = await writeResource(ref, data);
      console.log(`PUT written to ${filename} ${resource.singular} body:`, data);
      // let body = `<p>PUT ${resource.singular} ${data.id}</p>\n`;
      // body += `<p>Written to: ${filename}</p>\n`;
      // body += '<p>Body:</p>\n';
      // body += jsonhtml(data);
      ctx.body = data;
    });
}

