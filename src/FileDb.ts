import type { Dirent } from "node:fs";
import {
  access,
  constants,
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import util from "node:util";
import { execFile } from "node:child_process";
import { cloneDeep, throttle, merge } from "lodash-es";

import { config } from "./config.js";
import { log, logger } from "./logging.js";
import { toJson, fromJson } from "./utils.js";

const execFileP = util.promisify(execFile);

export interface IdResource {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IdResourceExtra extends IdResource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Create a new type but make all of the properties optional
type AllOptional<Type> = {
  [Property in keyof Type]+?: Type[Property];
};

export interface ResourceDef<T extends IdResource> {
  database: string;
  id?: string;
  name: string;
  singular: string;
  paramName: string;
  // Optional method to create a new object of this type,
  // supplying default values for any missing properties
  builder?: (props?: AllOptional<T>) => T;
  nestFiles?: boolean;
  parents?: ResourceDef<IdResource>[];
  // field to sort by in html views
  sortBy?: string;
}

function jsonToBuffer(data: object): Uint8Array {
  return new Uint8Array(Buffer.from(toJson(data)));
}

async function dirExists(dirpath: string): Promise<boolean> {
  try {
    const res = await stat(dirpath);
    return res.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filename: string): Promise<boolean> {
  try {
    await access(filename, constants.R_OK);
    return true;
  } catch {
    log(`File ${filename} does not exist.`);
    // cannot read file or it doesn't exist
    return false;
  }
}

async function ensureDir(dirpath: string) {
  // log(`ensureDir(${dirpath})`);
  if (!(await dirExists(dirpath))) {
    await mkdir(dirpath, { recursive: true });
  }
}

async function ensureResourceDir<T extends IdResource>(
  resource: ResourceDef<T>,
) {
  await ensureDir(resourceDir(resource));
}

function resourceDir<T extends IdResource>(resource: ResourceDef<T>): string {
  let path = "./db/unknown";
  if (resource.database === "grading") {
    path = config.DB_GRADING_DIR;
  } else if (resource.database === "indecisive") {
    path = config.DB_INDECISIVE_DIR;
  } else if (resource.database === "auth") {
    path = config.DB_AUTH_DIR;
  } else {
    throw new Error(
      `Unknown database ${resource.database} on resource ${resource.name}`,
    );
  }
  if (resource.nestFiles && resource.parents) {
    for (const parent of resource.parents) {
      if (parent.id) {
        path += `/${parent.name}/${parent.id}`;
      }
    }
  }
  path += `/${resource.name}`;
  return path;
}

function resourceFilename<T extends IdResource>(
  resource: ResourceDef<T>,
): string {
  return `${resourceDir(resource)}/${resource.id}.json`;
}

export async function resourceExists<T extends IdResource>(
  resource: ResourceDef<T>,
): Promise<boolean> {
  const filename = resourceFilename(resource);
  return fileExists(filename);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defd<T>(v: T | undefined): v is T {
  return v !== undefined;
}

async function getFiles(
  dirpath: string,
  ext?: string,
): Promise<{ path: string; name: string }[]> {
  const entries: Dirent[] = await readdir(dirpath, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => (ext ? entry.name.endsWith(`.${ext}`) : true))
      .map((entry) => ({
        path: entry.path,
        name: entry.name,
      })),
  );
}

export async function getAll<T extends IdResource>(
  resource: ResourceDef<T>,
): Promise<T[] | undefined> {
  const dirpath = resourceDir(resource);
  if (!(await dirExists(dirpath))) {
    log(`Directory ${dirpath} for ${resource} does not exist.`);
    return undefined;
  }
  try {
    const files = await getFiles(dirpath, "json");
    const resources = await Promise.all(
      files.map((file) => readFileAsJson<T>(`${file.path}/${file.name}`)),
    );
    // log(`Found ${resources.length} ${resource} resources.`);
    // return resources.filter(defd);
    return resources;
  } catch (err) {
    logger.error(
      `Error reading directory ${resource.name} resources from ${dirpath}.`,
      err,
    );
    return undefined;
  }
}

export async function getResourceIds(
  resource: ResourceDef<IdResource>,
): Promise<string[] | undefined> {
  const dirpath = resourceDir(resource);
  if (!(await dirExists(dirpath))) {
    return undefined;
  }
  try {
    const files = await getFiles(dirpath, "json");
    const ids = files.map((file) => file.name.slice(0, -5));
    return ids;
  } catch {
    return undefined;
  }
}

export async function readFileAsJson<T extends IdResource>(
  filename: string,
): Promise<T> {
  const buffer = await readFile(filename, "utf8");
  // log(`DONE reading from ${filename}.`);
  const data = fromJson<T>(buffer);
  // log(data);
  return data;
}

export async function readResource<T extends IdResource>(
  resource: ResourceDef<T>,
): Promise<T | undefined> {
  const filename = resourceFilename(resource);
  if (!(await fileExists(filename))) {
    log(
      `readResource(${resource.name}, ${resource.id}) ${filename} does not exist.`,
    );
    return undefined;
  }
  // log(`readResource(${resource}) to ${filename}.`);
  const data = readFileAsJson<T>(filename);
  return data;
}

async function gitCommit() {
  if (!config.DB_GIT_COMMIT_SCRIPT) {
    logger.error("gitCommit called but no commit script specified.");
    return;
  }
  try {
    const { stdout, stderr } = await execFileP(config.DB_GIT_COMMIT_SCRIPT);
    log(`execFile stdout:\n${stdout}`);
    log(`execFile stderr:\n${stderr}`);
    // await execFileP('git', ['add', '-A', 'db/']);
    // await execFileP('git', ['commit', '-m', 'Update db']);
    // log('DONE committing to git.');
  } catch (err) {
    logger.error("Error using git", err);
  }
}

const throttleGitCommit = throttle(gitCommit, 30 * 1000, {
  leading: false,
  trailing: true,
});

export async function deleteResourceDb<T extends IdResource>(
  resource: ResourceDef<T>,
): Promise<string | undefined> {
  const filename = resourceFilename(resource);
  if (!(await fileExists(filename))) {
    logger.error(
      `deleteResourceDb(${resource.name}, ${resource.id}) ${filename} does not exist.`,
    );
    return undefined;
  }
  log(`deleteResource(${resource.singular} ${resource.id}) from ${filename}.`);
  await unlink(filename);
  // log(`DONE deleting ${filename}.`);
  if (config.DB_GIT_COMMIT) {
    throttleGitCommit();
  }
  return filename;
}

export async function writeJsonToFile<T extends object>(
  filename: string,
  data: T,
): Promise<T> {
  const buffer = jsonToBuffer(data);
  await writeFile(filename, buffer);
  return data;
}

export interface WriteResourceOptions {
  updateTimestamps?: boolean;
  skipCommit?: boolean;
}

const WRITE_RESOURCE_OPTIONS_DEFAULT = {
  updateTimestamps: true,
  skipCommit: false,
};

export async function writeResource<T extends IdResource>(
  resource: ResourceDef<T>,
  data: T,
  options?: WriteResourceOptions,
): Promise<string | undefined> {
  options = merge(WRITE_RESOURCE_OPTIONS_DEFAULT, options);
  await ensureResourceDir(resource);
  if (options.updateTimestamps) {
    const ts = new Date().toISOString();
    data.updatedAt = ts;
    if (!data.createdAt) {
      data.createdAt = ts;
    }
  }
  const filename = resourceFilename(resource);
  log(`writeResource(${resource.singular} ${resource.id}) to ${filename}.`);
  await writeJsonToFile(filename, data);
  // log(`DONE writing to ${filename}.`);
  if (!options.skipCommit && config.DB_GIT_COMMIT) {
    throttleGitCommit();
  }
  return filename;
}

export function refWithId<T extends IdResource>(
  resource: ResourceDef<T>,
  id: string,
): ResourceDef<T> {
  const ref = cloneDeep(resource);
  ref.id = id;
  return ref;
}
