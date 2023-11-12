import { readdir, stat, constants, access, readFile, writeFile, mkdir } from 'node:fs/promises';
import util from 'node:util';
import { execFile } from 'node:child_process';
const execFileP = util.promisify(execFile);

type RecVal = string | boolean | null | number;
export interface RestResource {
  id: string;
  [key: string]: RestResource|RecVal|RecVal[]|RestResource[];
}

export interface ResourceDef {
  id?: string;
  resource: string;
  singular: string;
  paramName: string;
  parents?: ResourceDef[];
}

const ROOT = './db';

export function jsonToBuffer(data: RestResource): Uint8Array {
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
  console.log(`ensureDir(${dirpath})`);
  if (!await dirExists(dirpath)) {
    await mkdir(dirpath, { recursive: true });
  }
}

async function ensureRoot() {
  await ensureDir(ROOT);
}

async function ensureResourceDir(resource: string) {
  await ensureDir(`${ROOT}/${resource}`);
}

function resourceDir(resource: string): string {
  return `${ROOT}/${resource}`;
}

function resourceFilename(resource: string, id: string): string {
  return `${resourceDir(resource)}/${id}.json`;
}

export async function resourceExists(resource: string, id: string):Promise<boolean> {
  const filename = resourceFilename(resource, id);
  return fileExists(filename);
}

function defd<T>(v: T|undefined): v is T {
  return v !== undefined;
}

export async function getAll(resource: string):Promise<RestResource[]|undefined> {
  const dirpath = resourceDir(resource);
  if (!await dirExists(dirpath)) {
    console.log(`Directory ${dirpath} for ${resource} does not exist.`);
    return undefined;
  }
  try {
    const files = await readdir(dirpath);
    const resources = await Promise.all(files.map((file) => readFileAsJson(`${dirpath}/${file}`)));
    // console.log(`Found ${resources.length} ${resource} resources.`);
    return resources.filter(defd);
  } catch (err) {
    console.error(`Error reading directory ${resource} resources.`, err);
    return undefined;
  }
}

export async function getResourceIds(resource: string):Promise<string[]|undefined> {
  const dirpath = resourceDir(resource);
  if (!await dirExists(dirpath)) {
    return undefined;
  }
  try {
    const files = await readdir(dirpath);
    const ids = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.slice(0, -5));
    return ids;
  } catch {
    return undefined;
  }
}

async function readFileAsJson(filename:string):Promise<RestResource|undefined> {
  const buffer = await readFile(filename, 'utf8');
  console.log(`DONE reading from ${filename}.`);
  const data = JSON.parse(buffer);
  // console.log(data);
  return data;
}

export async function readResource(resource: string, id: string):Promise<RestResource|undefined> {
  const filename = resourceFilename(resource, id);
  if (!await fileExists(filename)) {
    return undefined;
  }
  console.log(`readResource(${resource}) to ${filename}.`);
  const data = readFileAsJson(filename);
  return data;
}

export async function writeResource(resource: string, data: RestResource) {
  await ensureResourceDir(resource);
  const buffer = jsonToBuffer(data);
  const filename = resourceFilename(resource, data.id);
  console.log(`writeResource(${resource}) to ${filename}.`);
  await writeFile(filename, buffer);
  console.log(`DONE writing to ${filename}.`);
  try {
    await execFileP('git', ['add', '-A', 'db/']);
    await execFileP('git', ['commit', '-m', 'Update db']);
    console.log('DONE committing to git.');
  } catch (err) {
    console.error('Error using git', err);
  }
  return filename;
}

export async function writeDb(name: string, data: RestResource) {
  await ensureRoot();
  const buffer = jsonToBuffer(data);
  await writeFile(`${ROOT}/${name}.json`, buffer);
}
