import { Buffer } from "buffer";
import nodeAssert from "node:assert/strict";

import { configure } from "safe-stable-stringify";

const stringify = configure({
  deterministic: true,
});

export function makeId(name: string): string {
  let id = name.toLowerCase();
  id = id.replace(/[^a-zA-Z0-9]/g, "-");
  id = id.replace(/-+/g, "-");
  return id;
}

export function base64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}

export function cycle<T>(array: T[], current?: T): T {
  if (current === undefined) {
    return array[0];
  } else {
    const index = array.findIndex((item) => item === current);
    if (index === undefined || index === array.length - 1) {
      return array[0];
    } else {
      return array[index + 1];
    }
  }
}

export function removeId(id: string, ids: string[]): string[] {
  return ids.filter((i) => i !== id);
}

// Create a new type but make all of the properties optional
export type AllOptional<Type> = {
  [Property in keyof Type]?: Type[Property];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonParser(key: string, value: any): any {
  if (typeof value === "string") {
    if (value.match(DATE_RE)) {
      return new Date(value);
    }
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonResolver(key: string, value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromJson<T>(buffer: string): T {
  const data = JSON.parse(buffer, jsonParser);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJson(data: any, indent: number = 2): string | undefined {
  return stringify(data, jsonResolver, indent);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonhtml(data: any): string {
  return `<pre>${toJson(data)}</pre>`;
}

export function shallowJson(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  data: Record<string, any>,
  indent = 2,
): string | undefined {
  const flatObj = Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const rep = Array.isArray(v) ? `[Array length=${v.length}]` : v;
      return [k, rep];
    }),
  );
  return toJson(flatObj, indent);
}

export function range(startOrEnd: number, end?: number): number[] {
  if (end) {
    return Array.from({ length: end - startOrEnd }, (v, i) => startOrEnd + i);
  } else {
    return Array.from({ length: startOrEnd }, (v, i) => i);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assert(assertion: boolean, msg?: any) {
  nodeAssert(assertion, msg);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(...data: any[]) {
  console.log(`${ts()}:`, ...data);
}

export function rand(n = 2) {
  return (Math.random() * 10 ** n).toFixed().toString().padStart(2, "0");
}

export function ts(
  {
    hours,
    minutes,
    seconds,
    ms,
  }: {
    hours: boolean;
    minutes: boolean;
    seconds: boolean;
    ms: boolean;
  } = {
    hours: false,
    minutes: false,
    seconds: true,
    ms: true,
  },
) {
  const timestamp = new Date();
  let result = "";
  if (hours) {
    if (result) {
      result += ":";
    }
    result += timestamp.getHours().toString().padStart(2, "0");
  }
  if (minutes) {
    if (result) {
      result += ":";
    }
    result += timestamp.getMinutes().toString().padStart(2, "0");
  }
  if (seconds) {
    if (result) {
      result += ":";
    }
    result += timestamp.getSeconds().toString().padStart(2, "0");
  }
  if (ms) {
    if (result) {
      result += ".";
    }
    result += timestamp.getMilliseconds().toString().padStart(3, "0");
  }
  return result;
}
