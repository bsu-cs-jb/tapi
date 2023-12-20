import { range } from "../utils.js";

const ALPHA_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHA_LOWER = "abcdefghijklmnopqrstuvwxyz";
const ALPHA = ALPHA_UPPER + ALPHA_LOWER;
const NUMBERS = "0123456789";
const SYMBOLS = "~!@#$%^&*()[]{}<>/|,.+=-?:;_";
const DICTIONARY = NUMBERS + ALPHA + SYMBOLS;
const B64_URL_DICT =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz" + NUMBERS + "-_";
const URL_SAFE_DICTIONARY = B64_URL_DICT;

export function gennum(): number {
  const randInt = Math.random() * 10 ** 17;
  const perfNowInt = (performance.now() * 10 ** 10) % 10 ** 17;
  const p = Math.round(randInt + perfNowInt);
  return p;
}

export function divmod(x: number, y: number): [div: number, rem: number] {
  const rem = x % y;
  const div = (x - rem) / y;
  return [div, rem];
}

export function encodeNumber(
  n: number,
  length?: number,
  dictionary?: string,
): string {
  if (!dictionary) {
    dictionary = DICTIONARY;
  }
  const DICT_LENGTH = dictionary.length;
  if (length === undefined) {
    length = Math.ceil(Math.log10(n) / Math.log10(DICT_LENGTH));
    // console.log(`Calculated length: ${length}`);
  }
  let c = n;
  let id = "";
  for (const _ of range(length)) {
    const [div, rem] = divmod(c, DICT_LENGTH);
    id = dictionary.at(rem) + id;
    c = div;
  }
  return id;
}

export function decodeId(id: string, dictionary?: string): number {
  if (!dictionary) {
    dictionary = URL_SAFE_DICTIONARY;
  }
  const DICT_LENGTH = dictionary.length;
  let num = 0;
  let pwr = 1;
  for (let i = id.length - 1; i >= 0; i--) {
    num += dictionary.indexOf(id[i]) * pwr;
    pwr *= DICT_LENGTH;
  }
  return num;
}

export function genid(length: number = 9): string {
  const num = gennum();
  const id = encodeNumber(num, length);
  return id;
}

export function urlid(length: number = 10): string {
  const num = gennum();
  const id = encodeNumber(num, length, URL_SAFE_DICTIONARY);
  return id;
}
