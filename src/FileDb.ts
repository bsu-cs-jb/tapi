import { stat, constants, access, readFile, writeFile, mkdir } from 'node:fs/promises';
import util from 'node:util';
import { execFile } from 'node:child_process';
const execFileP = util.promisify(execFile);

type RecVal = string | boolean | null | number;
interface RestResource {
  id: string;
  [key: string]: RestResource|RecVal|RecVal[]|RestResource[];
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

function resourceFilename(resource: string, id: string): string {
  return `${ROOT}/${resource}/${id}.json`;
}

export async function resourceExists(resource: string, id: string):Promise<boolean> {
  const filename = resourceFilename(resource, id);
  return fileExists(filename);
}

export async function readResource(resource: string, id: string):Promise<RestResource|undefined> {
  const filename = resourceFilename(resource, id);
  if (!await fileExists(filename)) {
    return undefined;
  }
  console.log(`readResource(${resource}) to ${filename}.`);
  const buffer = await readFile(filename, 'utf8');
  console.log(`DONE reading from ${filename}.`);
  const data = JSON.parse(buffer);
  console.log(data);
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
