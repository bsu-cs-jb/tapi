import type { Dirent } from 'node:fs';
import {
  readdir,
  stat,
  constants,
  access,
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import util from 'node:util';
import { cloneDeep } from 'lodash-es';
import { execFile } from 'node:child_process';
const execFileP = util.promisify(execFile);

type RecVal = string | boolean | null | number;
export interface RestResource {
  id: string;
  [key: string]: RestResource|RecVal|RecVal[]|RestResource[];
}

export interface IdResource {
  id: string;
  name: string;
}

// Create a new type but make all of the properties optional
type AllOptional<Type> = {
  [Property in keyof Type]?: Type[Property];
};

export interface ResourceDef {
  id?: string;
  name: string;
  singular: string;
  paramName: string;
  // Optional method to create a new object of this type,
  // supplying default values for any missing properties
  builder?: <T extends IdResource>(props?: AllOptional<T>) => IdResource;
  parents?: ResourceDef[];
}

const ROOT = './db';

export function jsonToBuffer(data: IdResource): Uint8Array {
  return new Uint8Array(Buffer.from(JSON.stringify(data, undefined, 2)));
}

async function dirExists(dirpath:string):Promise<boolean> {
  try {
    const res = await stat(dirpath);
    return res.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filename:string):Promise<boolean> {
  try {
    await access(filename, constants.R_OK);
    return true;
  } catch {
    console.log(`File ${filename} does not exist.`);
    // cannot read file or it doesn't exist
    return false;
  }
}

async function ensureDir(dirpath:string) {
  // console.log(`ensureDir(${dirpath})`);
  if (!await dirExists(dirpath)) {
    await mkdir(dirpath, { recursive: true });
  }
}

async function ensureRoot() {
  await ensureDir(ROOT);
}

async function ensureResourceDir(resource: ResourceDef) {
  await ensureDir(resourceDir(resource));
}

function resourceDir(resource: ResourceDef): string {
  let path = ROOT;
  if (resource.parents) {
    for (const parent of resource.parents) {
      if (parent.id) {
        path += `/${parent.name}/${parent.id}`;
      }
    }
  }
  path += `/${resource.name}`;
  return path;
}

function resourceFilename(resource: ResourceDef): string {
  return `${resourceDir(resource)}/${resource.id}.json`;
}

export async function resourceExists(resource: ResourceDef):Promise<boolean> {
  const filename = resourceFilename(resource);
  return fileExists(filename);
}

function defd<T>(v: T|undefined): v is T {
  return v !== undefined;
}

async function getFiles(dirpath: string, ext?:string): Promise<{ path:string, name:string }[]> {
  const entries: Dirent[] = await readdir(dirpath, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => ext ? entry.name.endsWith(`.${ext}`) : true)
      .map((entry) => (
        {
          path: entry.path,
          name: entry.name,
        }))
  );
}

export async function getAll(resource: ResourceDef):Promise<IdResource[]|undefined> {
  const dirpath = resourceDir(resource);
  if (!await dirExists(dirpath)) {
    console.log(`Directory ${dirpath} for ${resource} does not exist.`);
    return undefined;
  }
  try {
    const files = await getFiles(dirpath, 'json');
    const resources = await Promise.all(files.map((file) => readFileAsJson(`${file.path}/${file.name}`)));
    // console.log(`Found ${resources.length} ${resource} resources.`);
    // return resources.filter(defd);
    return resources;
  } catch (err) {
    console.error(`Error reading directory ${resource.name} resources from ${dirpath}.`, err);
    return undefined;
  }
}

export async function getResourceIds(resource: ResourceDef):Promise<string[]|undefined> {
  const dirpath = resourceDir(resource);
  if (!await dirExists(dirpath)) {
    return undefined;
  }
  try {
    const files = await getFiles(dirpath, 'json');
    const ids = files.map((file) => file.name.slice(0, -5));
    return ids;
  } catch {
    return undefined;
  }
}

async function readFileAsJson<T extends IdResource>(filename:string):Promise<T> {
  const buffer = await readFile(filename, 'utf8');
  console.log(`DONE reading from ${filename}.`);
  const data = JSON.parse(buffer);
  // console.log(data);
  return data;
}

export async function readResource<T extends IdResource>(resource: ResourceDef):Promise<T|undefined> {
  const filename = resourceFilename(resource);
  if (!await fileExists(filename)) {
    console.log(`readResource(${resource.name}, ${resource.id}) ${filename} does not exist.`);
    return undefined;
  }
  // console.log(`readResource(${resource}) to ${filename}.`);
  const data = readFileAsJson<T>(filename);
  return data;
}

export async function writeResource(resource: ResourceDef, data: IdResource) {
  await ensureResourceDir(resource);
  const buffer = jsonToBuffer(data);
  const filename = resourceFilename(resource);
  console.log(`writeResource(${resource.singular} ${resource.id}) to ${filename}.`);
  await writeFile(filename, buffer);
  // console.log(`DONE writing to ${filename}.`);
  try {
    // await execFileP('git', ['add', '-A', 'db/']);
    // await execFileP('git', ['commit', '-m', 'Update db']);
    // console.log('DONE committing to git.');
  } catch (err) {
    console.error('Error using git', err);
  }
  return filename;
}

export async function writeDb(name: string, data: IdResource) {
  await ensureRoot();
  const buffer = jsonToBuffer(data);
  await writeFile(`${ROOT}/${name}.json`, buffer);
}

export function refWithId(resource: ResourceDef, id: string):ResourceDef {
  const ref = cloneDeep(resource);
  ref.id = id;
  return ref;
}

