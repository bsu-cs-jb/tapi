
import { configure } from "safe-stable-stringify";

const stringify = configure({
  deterministic: true,
});

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

