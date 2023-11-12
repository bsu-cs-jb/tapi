// import fsPromises from "fs";
import { writeFile, mkdir } from 'node:fs/promises';

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

export async function writeResource(resource: string, data: any) {
  await ensureResourceDir(resource);
  const buffer = jsonToBuffer(data);
  const filename = `${ROOT}/${resource}/${data.id}.json`;
  console.log(`writeResource(${resource}) to ${filename}.`);
  const result = await writeFile(filename, buffer);
  console.log(`DONE writing to ${filename}.`);
  return filename;
}

export async function writeDb(name: string, data: any) {
  await ensureRoot();
  const buffer = jsonToBuffer(data);
  const result = await writeFile(`${ROOT}/${name}.json`, buffer);
}
