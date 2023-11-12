import { constants, access, readFile, writeFile, mkdir } from 'node:fs/promises';
import util from 'node:util';
import { execFile } from 'node:child_process';
const execFileP = util.promisify(execFile);

const ROOT = "./db";

export function jsonToBuffer(data: any): Uint8Array {
  return new Uint8Array(Buffer.from(JSON.stringify(data, undefined, 2)));
}

async function ensureRoot() {
  // TODO: check for existence first 
  console.log('ensureRoot()');
  await mkdir(ROOT, { recursive: true });
}

async function ensureResourceDir(resource: string) {
  // TODO: check for existence first 
  await ensureRoot();
  console.log(`ensureResourceDir(${resource})`);
  await mkdir(`${ROOT}/${resource}`, { recursive: true });
}

function resourceFilename(resource: string, id: string): string {
  return `${ROOT}/${resource}/${id}.json`;
}

export async function readResource(resource: string, id: string):Promise<any|undefined> {
  const filename = resourceFilename(resource, id);
  try {
    await access(filename, constants.R_OK);
  } catch {
    console.log(`File ${filename} does not exist.`);
    // cannot read file or it doesn't exist
    return undefined;
  }
  console.log(`readResource(${resource}) to ${filename}.`);
  const buffer = await readFile(filename, 'utf8');
  console.log(`DONE reading from ${filename}.`);
  const data = JSON.parse(buffer);
  console.log(data);
  return data;
}

export async function writeResource(resource: string, data: any) {
  await ensureResourceDir(resource);
  const buffer = jsonToBuffer(data);
  const filename = resourceFilename(resource, data.id);
  console.log(`writeResource(${resource}) to ${filename}.`);
  const result = await writeFile(filename, buffer);
  console.log(`DONE writing to ${filename}.`);
  try {
    await execFile('git', ['add', '-A', 'db/']);
    await execFile('git', ['commit', '-m', 'Update db']);
    console.log(`DONE committing to git.`);
  } catch (err) {
    console.error('Error using git', err);
  }
  return filename;
}

export async function writeDb(name: string, data: any) {
  await ensureRoot();
  const buffer = jsonToBuffer(data);
  const result = await writeFile(`${ROOT}/${name}.json`, buffer);
}
