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
import { cloneDeep, throttle } from "lodash-es";

import { config } from "./config.js";
import { toJson, fromJson } from "./utils.js";

const execFileP = util.promisify(execFile);

export interface IdResource {
  id: string;
  name: string;
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

// const ROOT = './db';
// const ROOT = './cs411-db/grading-db';

export function jsonToBuffer(data: IdResource): Uint8Array {
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
    console.log(`File ${filename} does not exist.`);
    // cannot read file or it doesn't exist
    return false;
  }
}

async function ensureDir(dirpath: string) {
  // console.log(`ensureDir(${dirpath})`);
  if (!(await dirExists(dirpath))) {
    await mkdir(dirpath, { recursive: true });
  }
}

async function ensureRoot() {
  await ensureDir(config.DB_GRADING_DIR);
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
    console.log(`Directory ${dirpath} for ${resource} does not exist.`);
    return undefined;
  }
  try {
    const files = await getFiles(dirpath, "json");
    const resources = await Promise.all(
      files.map((file) => readFileAsJson<T>(`${file.path}/${file.name}`)),
    );
    // console.log(`Found ${resources.length} ${resource} resources.`);
    // return resources.filter(defd);
    return resources;
  } catch (err) {
    console.error(
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

async function readFileAsJson<T extends IdResource>(
  filename: string,
): Promise<T> {
  const buffer = await readFile(filename, "utf8");
  // console.log(`DONE reading from ${filename}.`);
  const data = fromJson<T>(buffer);
  // console.log(data);
  return data;
}

export async function readResource<T extends IdResource>(
  resource: ResourceDef<T>,
): Promise<T | undefined> {
  const filename = resourceFilename(resource);
  if (!(await fileExists(filename))) {
    console.log(
      `readResource(${resource.name}, ${resource.id}) ${filename} does not exist.`,
    );
    return undefined;
  }
  // console.log(`readResource(${resource}) to ${filename}.`);
  const data = readFileAsJson<T>(filename);
  return data;
}

async function gitCommit() {
  if (!config.DB_GIT_COMMIT_SCRIPT) {
    console.error("gitCommit called but no commit script specified.");
    return;
  }
  try {
    const { stdout, stderr } = await execFileP(config.DB_GIT_COMMIT_SCRIPT);
    console.log(`execFile stdout:\n${stdout}`);
    console.log(`execFile stderr:\n${stderr}`);
    // await execFileP('git', ['add', '-A', 'db/']);
    // await execFileP('git', ['commit', '-m', 'Update db']);
    // console.log('DONE committing to git.');
  } catch (err) {
    console.error("Error using git", err);
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
    console.log(
      `deleteResourceDb(${resource.name}, ${resource.id}) ${filename} does not exist.`,
    );
    return undefined;
  }
  console.log(
    `deleteResource(${resource.singular} ${resource.id}) from ${filename}.`,
  );
  await unlink(filename);
  // console.log(`DONE writing to ${filename}.`);
  if (config.DB_GIT_COMMIT) {
    throttleGitCommit();
  }
  return filename;
}

export async function writeResource<T extends IdResource>(
  resource: ResourceDef<T>,
  data: T,
  updateTimestamps = true,
): Promise<string | undefined> {
  await ensureResourceDir(resource);
  if (updateTimestamps) {
    const ts = new Date().toISOString();
    data.updatedAt = ts;
    if (!data.createdAt) {
      data.createdAt = ts;
    }
  }
  const buffer = jsonToBuffer(data);
  const filename = resourceFilename(resource);
  console.log(
    `writeResource(${resource.singular} ${resource.id}) to ${filename}.`,
  );
  await writeFile(filename, buffer);
  // console.log(`DONE writing to ${filename}.`);
  if (config.DB_GIT_COMMIT) {
    throttleGitCommit();
  }
  return filename;
}

export async function writeDb<T extends IdResource>(name: string, data: T) {
  await ensureRoot();
  const buffer = jsonToBuffer(data);
  await writeFile(`${config.DB_GRADING_DIR}/${name}.json`, buffer);
}

export function refWithId<T extends IdResource>(
  resource: ResourceDef<T>,
  id: string,
): ResourceDef<T> {
  const ref = cloneDeep(resource);
  ref.id = id;
  return ref;
}
