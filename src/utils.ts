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

// Create a new type but make all of the properties optional
export type AllOptional<Type> = {
  [Property in keyof Type]?: Type[Property];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function json(data: any): string {
  return JSON.stringify(data, undefined, 2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonhtml(data: any): string {
  return `<pre>${json(data)}</pre>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shallowJson(data: Record<string, any>, indent = 2): string {
  const flatObj = Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const rep = Array.isArray(v)
        ? `[Array length=${v.length}]`
        : v.toString();
      return [k, rep];
    }),
  );
  return JSON.stringify(flatObj, undefined, indent);
}

export function range(startOrEnd: number, end?: number): number[] {
  if (end) {
    return Array.from({ length: end - startOrEnd }, (v, i) => startOrEnd + i);
  } else {
    return Array.from({ length: startOrEnd }, (v, i) => i);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assert(assertion: boolean, msg?: any, ...args: any[]) {
  console.assert(assertion, msg, ...args);
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
