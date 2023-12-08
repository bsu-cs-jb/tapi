import { createHmac } from "crypto";
import { json } from "./utils.js";

const { HASH_SECRET } = process.env;

const SECRET = HASH_SECRET || "294S@t>9w";

export function hash(str: string): string {
  const hash = createHmac("sha256", SECRET).update(str).digest("base64url");
  return hash;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hashId(data: Record<string, any>, length: number = 8): string {
  const hash = createHmac("sha256", SECRET)
    .update(json(data))
    .digest("base64url");
  return hash.substring(0, length);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withId<T extends Record<string, any>>(
  data: T,
): T & { id: string } {
  return {
    ...data,
    id: hashId(data),
  };
}
