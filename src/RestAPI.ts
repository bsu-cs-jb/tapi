import Router from "@koa/router";
import { Context } from "koa";
import { cloneDeep, sortBy, capitalize } from "lodash-es";

import { urlid } from "./genid.js";
import { log, jsonhtml, shallowJson, assert } from "./utils.js";
import {
  deleteResourceDb,
  getAll,
  IdResource,
  readResource,
  refWithId,
  ResourceDef,
  resourceExists,
  writeResource,
} from "./FileDb.js";

type IdName = { id: string; name: string };

function routeLog<T extends IdResource>(
  method: string,
  type: string,
  resource: ResourceDef<T>,
  name: string,
  url: string,
) {
  log(
    `${method.padEnd(4)} route for ${type.padEnd(10)} ${resource.name.padStart(
      8,
    )} Name: ${name.padEnd(18)} Url: ${url}`,
  );
}

export function collectionRoute<T extends IdResource>(
  resource: ResourceDef<T>,
): {
  name: string;
  url: string;
} {
  let collection_name = "";
  let collection_url = "";
  if (resource.parents) {
    for (const parent of resource.parents) {
      collection_name += `${parent.name}-`;
      collection_url += `${parent.name}/:${parent.paramName}/`;
    }
  }
  collection_name += resource.name;
  collection_url += `${resource.name}`;

  return {
    name: collection_name,
    url: collection_url,
  };
}

export function resourceRoute<T extends IdResource>(
  resource: ResourceDef<T>,
): {
  name: string;
  url: string;
} {
  let resource_name = "";
  let resource_url = "";
  if (resource.parents) {
    for (const parent of resource.parents) {
      resource_name += `${parent.name}-`;
      resource_url += `${parent.name}/:${parent.paramName}/`;
    }
  }
  resource_name += resource.singular;
  resource_url += `${resource.name}/:${resource.paramName}`;

  return {
    name: resource_name,
    url: resource_url,
  };
}

export function resourceRouteUrl<T extends IdResource>(
  resource: ResourceDef<T>,
): string {
  return resourceRoute(resource).url;
}

export function resourceRouteName<T extends IdResource>(
  resource: ResourceDef<T>,
): string {
  return resourceRoute(resource).name;
}

export function resourceFromContext<T extends IdResource>(
  resource: ResourceDef<T>,
  id?: string,
  ctx?: Record<string, string>,
): ResourceDef<T> {
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

export function routerParam<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  processFn?: (obj: T) => T | undefined,
): Router {
  return router.param(resource.paramName, async (id, ctx, next) => {
    const ref = resourceFromContext(resource, id, ctx.params);
    let obj = await readResource<T>(ref);
    if (processFn && obj) {
      obj = processFn(obj);
    }
    ctx[resource.singular] = obj;
    if (!ctx[resource.singular]) {
      ctx.status = 404;
      console.error(`${resource.singular} id '${id}' not found.`);
      return;
    }
    await next();
  });
}

export function linkList<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  resources: IdName[],
  urlParams: Record<string, string> = {},
): string {
  // console.log(`linkList(router, ${resource.paramName}, ${resource.singular}, ${resources.length})`);
  if (!resources) {
    return `<div><p>${capitalize(
      resource.name,
    )} collection is empty.</p></div>`;
  }
  let result = `<div><p>${capitalize(resource.name)} collection</p><ul>`;
  if (resource.sortBy) {
    resources = sortBy(resources, resource.sortBy);
  }
  const { name: resource_name } = resourceRoute(resource);
  for (const r of resources) {
    const href = router.url(`${resource_name}-html`, {
      [resource.paramName]: r.id,
      ...urlParams,
    });
    // console.log(`<p><a href="${href}">${r.name} - ${r.id}</a></p>`);
    result += `<li><a href="${href}">${r.name} - ${r.id}</a></li>\n`;
  }
  return result + "</ul></div>";
}

export interface RestOptions<T extends IdResource> {
  processHtml?: (
    item: T,
    body: string,
    router: Router,
    resource: ResourceDef<T>,
    subCollections?: ResourceDef<IdResource>[],
  ) => string;
  preProcess?: (ctx: Context, data: T, resource: ResourceDef<T>) => Promise<T>;
  postProcess?: (
    ctx: Context,
    data: T,
    resource: ResourceDef<T>,
  ) => Promise<void>;
}

export function getCollection<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
): Router {
  const { name: collection_name, url: collection_url } =
    collectionRoute(resource);
  routeLog("GET", "collection", resource, collection_name, collection_url);

  return router
    .get(
      `${collection_name}-html`,
      `/${collection_url}.html`,
      async (ctx: Context) => {
        const collection = await getAll(resource);
        log(`Found ${collection?.length} ${resource.name}.`);
        let body = `<!DOCTYPE html>\n<html><head><title>${capitalize(
          resource.name,
        )}</title></head><body>`;
        body += `<p>${collection?.length || 0} ${capitalize(
          resource.name,
        )}:<p>\n`;
        if (collection) {
          body += linkList(router, resource, collection);
        }
        body += "\n</body></html>";
        ctx.body = body;
      },
    )
    .get(collection_name, `/${collection_url}`, async (ctx: Context) => {
      const collection = await getAll(resource);
      // ctx.body = JSON.stringify(collection);
      ctx.body = collection;
    });
}

export function getResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  subCollections?: ResourceDef<IdResource>[],
  options?: RestOptions<T>,
): Router {
  const { name: resource_name, url: resource_url } = resourceRoute(resource);
  routeLog("GET", "resource", resource, resource_name, resource_url);

  return router
    .get(
      `${resource_name}-html`,
      `/${resource_url}.html`,
      async (ctx: Context) => {
        // const { course, params: { courseId } } = ctx;
        const item = ctx[resource.singular];
        let body = "";
        body += `<!DOCTYPE html>\n<html><head><title>${capitalize(
          resource.singular,
        )}: ${item.name}</title></head><body>`;
        body += `<p><a href="${router.url(
          resource.name + "-html",
        )}">${capitalize(resource.name)}</a></p>`;
        body += `<p>${capitalize(resource.singular)} id: ${item.id}</p>`;
        body += `<p>${capitalize(resource.singular)} name: ${item.name}</p>`;
        if (options?.processHtml) {
          body = options.processHtml(
            item,
            body,
            router,
            resource,
            subCollections,
          );
        }
        if (subCollections) {
          for (const sr of subCollections) {
            body += linkList(router, sr, item[sr.name], {
              [resource.paramName]: item.id,
            });
          }
        }
        body += jsonhtml(item);
        body += "</body></html>";
        ctx.body = body;
      },
    )
    .get(resource_name, `/${resource_url}`, async (ctx: Context) => {
      // const { course, params: { courseId } } = ctx;
      const item = ctx[resource.singular];
      ctx.body = item;
    });
}

export function postResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  options?: RestOptions<T>,
): Router {
  const { name: collection_name, url: collection_url } =
    collectionRoute(resource);
  routeLog("POST", "collection", resource, collection_name, collection_url);

  router.post(
    `${collection_name}-post`,
    `/${collection_url}`,
    async (ctx: Context, next) => {
      const data = ctx.request.body;
      let newResource = data;
      if (resource.builder) {
        newResource = resource.builder(data);
      }
      if (options?.preProcess) {
        newResource = await options.preProcess(ctx, newResource, resource);
      }
      if (!newResource.id) {
        newResource.id = urlid();
      }
      const ref = refWithId(resource, newResource.id);
      if (await resourceExists(ref)) {
        ctx.body = `<p>${capitalize(resource.singular)} with id '${
          newResource.id
        }' already exists. Failing</p>\n`;
        ctx.status = 400;
        return await next();
      }
      const filename = await writeResource(ref, newResource);
      if (options?.postProcess) {
        await options.postProcess(ctx, newResource, resource);
      }
      console.log(
        `POST written to ${filename} ${resource.singular}:`,
        newResource,
      );
      ctx.body = newResource;
    },
  );
  return router;
}

interface RouteName {
  name?: string;
  path: string;
}

/*
 * Returns list of routes defined.
 */
export function deleteResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  options?: RestOptions<T>,
): RouteName[] {
  const { name: resource_name, url: resource_url } = resourceRoute(resource);
  routeLog("DELETE", "resource", resource, resource_name, resource_url);

  const ROUTE_NAMES = [
    {
      name: `${resource_name}-delete`,
      path: `/${resource_url}`,
    },
  ];

  router.delete(
    `${resource_name}-delete`,
    `/${resource_url}`,
    async (ctx: Context) => {
      // get the existing resource
      const obj = ctx[resource.singular];
      assert(obj !== undefined && obj !== null);

      // Make sure the id of the resource matches
      const id = ctx.params[resource.paramName];
      assert(obj.id !== undefined && obj.id === id);
      const ref = refWithId(resource, id);

      const filename = await deleteResourceDb(ref);

      if (filename !== undefined) {
        if (options?.postProcess) {
          options.postProcess(ctx, obj, ref);
        }
      }

      log(`DELETE file ${filename} for ${resource.singular} id ${id}`);
    },
  );

  return ROUTE_NAMES;
}

export function putResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
): Router {
  const { name: resource_name, url: resource_url } = resourceRoute(resource);
  routeLog("PUT", "resource", resource, resource_name, resource_url);

  return router.put(
    `${resource_name}-put`,
    `/${resource_url}`,
    async (ctx: Context) => {
      const data = ctx.request.body;

      // get the existing resource
      const obj = ctx[resource.singular];
      assert(obj !== undefined && obj !== null);

      // Make sure the id of the resource matches
      const id = ctx.params[resource.paramName];
      if (data.id) {
        assert(data.id === id);
      } else {
        data.id = id;
      }
      const ref = refWithId(resource, data.id);

      // don't let the API override createdAt
      if (obj.createdAt) {
        data.createdAt = obj.createdAt;
      }

      const filename = await writeResource(ref, data);
      // console.log(`PUT written to ${filename} ${resource.singular} body:`, data);
      console.log(
        `PUT written to ${filename} ${resource.singular}:`,
        shallowJson(data),
      );
      ctx.body = data;
    },
  );
}
