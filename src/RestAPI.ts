import Router from "@koa/router";
import { Context, Next } from "koa";
import { merge, cloneDeep, sortBy, capitalize } from "lodash-es";

import { urlid } from "./utils/genid.js";
import { assert } from "./utils.js";
import { jsonhtml, shallowJson } from "./utils/json.js";
import { log, logger } from "./utils/logging.js";
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

export interface IdName {
  id: string;
  name: string;
}

interface RouteName {
  name?: string;
  path: string;
}

function routeLog<T extends IdResource>(
  method: string,
  type: string,
  resource: ResourceDef<T>,
  name: string,
  url: string,
) {
  // Disable logging since IDK how to do it easier
  if (url === "DISABLED") {
    log(
      `${method.padEnd(4)} route for ${type.padEnd(
        10,
      )} ${resource.name.padStart(8)} Name: ${name.padEnd(18)} Url: ${url}`,
    );
  }
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
  ctx?: Context,
): ResourceDef<T> {
  const ref = cloneDeep(resource);
  if (id) {
    ref.id = id;
  }
  if (ctx && ref.parents) {
    // log(`resourceFromContext(${resource.name},${id})`, {
    //   parents: ref.parents,
    // });
    for (const parent of ref.parents) {
      if (parent.singular in ctx.state) {
        parent.id = ctx.state[parent.singular];
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
  return router.param(
    resource.paramName,
    async (id: string, ctx: Context, next: Next) => {
      const ref = resourceFromContext(resource, id, ctx);
      let obj = await readResource<T>(ref);
      if (processFn && obj) {
        obj = processFn(obj);
      }
      // ctx[resource.singular] = obj;
      ctx.state[resource.singular] = obj;
      if (!ctx.state[resource.singular]) {
        const message = `${resource.singular} id '${id}' not found.`;
        ctx.status = 404;
        ctx.body = {
          status: "error",
          message,
        };
        logger.error(message);
        return;
      }
      await next();
    },
  );
}

export function linkList<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  resources: IdResource[],
  urlParams: Record<string, string> = {},
): string {
  // log(`linkList(router, ${resource.paramName}, ${resource.singular}, ${resources.length})`);
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
    // log(`<p><a href="${href}">${r.name} - ${r.id}</a></p>`);
    if (r.name) {
      result += `<li><a href="${href}">${r.name} - ${r.id}</a></li>\n`;
    } else {
      result += `<li><a href="${href}">${r.id}</a></li>\n`;
    }
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
  preProcess?: (
    ctx: Context,
    data: T,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    body: any,
    resource: ResourceDef<T>,
  ) => Promise<T | undefined>;
  postProcess?: (
    ctx: Context,
    data: T,
    resource: ResourceDef<T>,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ) => Promise<any | undefined>;
}

export function getCollection<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  options?: RestOptions<T>,
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
        // log(`Found ${collection?.length} ${resource.name}.`);
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
    .get(
      collection_name,
      `/${collection_url}`,
      async (ctx: Context, next: Next) => {
        const contentType = ctx.accepts("json", "html");
        let collection = await getAll(resource);

        if (contentType === "json") {
          if (collection && options?.postProcess) {
            const postProcess = options.postProcess;
            const processed: (T | undefined)[] = await Promise.all(
              collection.map(async (item): Promise<T | undefined> => {
                const ref = refWithId(resource, item.id);
                return await postProcess(ctx, item, ref);
              }),
            );
            collection = processed.filter((s): s is T => s !== undefined);
          }
          ctx.body = collection;
        } else {
          // log(`Found ${collection?.length} ${resource.name}.`);
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
        }

        await next();
      },
    );
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
        let item = ctx.state[resource.singular];
        if (options?.postProcess) {
          const ref = refWithId(resource, item.id);
          item = await options.postProcess(ctx, item, ref);
        }
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
    .get(
      resource_name,
      `/${resource_url}`,
      async (ctx: Context, next: Next) => {
        let item = ctx.state[resource.singular];
        if (options?.postProcess) {
          const ref = refWithId(resource, item.id);
          item = await options.postProcess(ctx, item, ref);
        }
        ctx.body = item;
        await next();
      },
    );
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
    async (ctx: Context, next: Next) => {
      const origBody = cloneDeep(ctx.request.body);
      let newResource = ctx.request.body;
      if (resource.builder) {
        newResource = resource.builder(newResource);
      }
      if (options?.preProcess) {
        newResource = await options.preProcess(
          ctx,
          newResource,
          origBody,
          resource,
        );
      }
      if (!newResource.id) {
        newResource.id = urlid();
      }
      const ref = refWithId(resource, newResource.id);
      if (await resourceExists(ref)) {
        ctx.status = 409;
        const message = `${capitalize(resource.singular)} with id '${
          newResource.id
        }' already exists.`;
        logger.error(message);
        ctx.body = {
          status: "error",
          message,
        };
        return await next();
      }

      const result = await writeResource(ref, newResource);
      if (typeof result === "undefined") {
        logger.error(
          `POST failed write for ${resource.singular}:`,
          newResource,
        );
        ctx.status = 500;
        ctx.body = {
          status: "error",
          message: `Failed writeResource for ${resource.singular}`,
        };
        return;
      }
      [newResource] = result;
      const [_, filename] = result;
      log(`POST written to ${filename} ${resource.singular}:`, newResource);
      if (options?.postProcess) {
        newResource = await options.postProcess(ctx, newResource, ref);
      }
      ctx.body = newResource;

      return await next();
    },
  );
  return router;
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
      const obj = ctx.state[resource.singular];
      assert(obj !== undefined && obj !== null, "delete obj must be defined");

      // Make sure the id of the resource matches
      const id = ctx.params[resource.paramName];
      assert(obj.id !== undefined && obj.id === id, "obj.id must match id");
      const ref = refWithId(resource, id);

      const filename = await deleteResourceDb(ref);

      if (filename !== undefined && options?.postProcess) {
        await options.postProcess(ctx, obj, ref);
      }

      log(`DELETE file ${filename} for ${resource.singular} id ${id}`);
      ctx.body = {
        status: "success",
        message: `Session ${id} succesfully deleted.`,
      };

      // If any routes after this try to use the route parameter for this item,
      // they will fail and get a 404.
      // await next();
    },
  );

  return ROUTE_NAMES;
}

export function putResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  options?: RestOptions<T>,
): Router {
  const { name: resource_name, url: resource_url } = resourceRoute(resource);
  routeLog("PUT", "resource", resource, resource_name, resource_url);

  return router.put(
    `${resource_name}-put`,
    `/${resource_url}`,
    async (ctx: Context, next: Next) => {
      const origBody = cloneDeep(ctx.request.body);
      let newResource = ctx.request.body;

      // get the existing resource
      const obj = ctx.state[resource.singular];
      assert(obj !== undefined && obj !== null);

      // Make sure the id of the resource matches
      const id = ctx.params[resource.paramName];
      if (newResource.id && newResource.id !== id) {
        // assert(data.id === id, "id in body and URL must match");
        ctx.status = 400;
        ctx.body = {
          status: "error",
          reason: "validation_error",
          message: `body id (${newResource.id}) does not match id in URL (${id}).`,
        };
        return;
      } else {
        newResource.id = id;
      }
      const ref = refWithId(resource, newResource.id);

      if (options?.preProcess) {
        newResource = await options.preProcess(ctx, newResource, origBody, ref);
      }

      // don't let the API override createdAt
      if (obj.createdAt) {
        newResource.createdAt = obj.createdAt;
      }

      const result = await writeResource(ref, newResource);
      if (typeof result === "undefined") {
        logger.error(`PUT failed write for ${resource.singular}:`, newResource);
        ctx.status = 500;
        ctx.body = {
          status: "error",
          message: `Failed writeResource for ${resource.singular}`,
        };
        return;
      }

      [newResource] = result;
      const [_, filename] = result;
      log(
        `PUT written to ${filename} ${resource.singular}:`,
        shallowJson(newResource),
      );
      if (options?.postProcess) {
        newResource = await options.postProcess(ctx, newResource, ref);
      }
      ctx.body = newResource;

      return await next();
    },
  );
}

export function patchResource<T extends IdResource>(
  router: Router,
  resource: ResourceDef<T>,
  options?: RestOptions<T>,
): Router {
  const { name: resource_name, url: resource_url } = resourceRoute(resource);
  routeLog("PUT", "resource", resource, resource_name, resource_url);

  return router.patch(
    `${resource_name}-patch`,
    `/${resource_url}`,
    async (ctx: Context, next: Next) => {
      const origBody = cloneDeep(ctx.request.body);
      let newResource = ctx.request.body;

      // get the existing resource
      const obj = ctx.state[resource.singular];
      assert(obj !== undefined && obj !== null);

      // Make sure the id of the resource matches
      const id = ctx.params[resource.paramName];
      if (newResource.id !== undefined) {
        assert(newResource.id === id);
      } else {
        newResource.id = id;
      }

      // Update the existing object with new fields
      newResource = merge(obj, newResource);

      const ref = refWithId(resource, newResource.id);
      if (options?.preProcess) {
        newResource = await options.preProcess(ctx, newResource, origBody, ref);
      }

      // don't let the API override createdAt
      if (obj.createdAt) {
        newResource.createdAt = obj.createdAt;
      }

      const result = await writeResource(ref, newResource);
      if (typeof result === "undefined") {
        logger.error(
          `PATCH failed write for ${resource.singular}:`,
          newResource,
        );
        ctx.status = 500;
        ctx.body = {
          status: "error",
          message: `Failed writeResource for ${resource.singular}`,
        };
        return;
      }

      [newResource] = result;
      const [_, filename] = result;
      log(
        `PATCH written to ${filename} ${resource.singular}:`,
        shallowJson(newResource),
      );
      if (options?.postProcess) {
        newResource = await options.postProcess(ctx, newResource, ref);
      }
      ctx.body = newResource;

      return await next();
    },
  );
}
