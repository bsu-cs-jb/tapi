// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function json(data: any): string {
  return JSON.stringify(data, undefined, 2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonhtml(data: any): string {
  return `<pre>${json(data)}</pre>`;
}


export function range(startOrEnd: number, end?: number): number[] {
  if (end) {
    return Array.from({ length: end - startOrEnd }, (v, i) => startOrEnd + i);
  } else {
    return Array.from({ length: startOrEnd }, (v, i) => i);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assert(assertion:boolean, msg?:any, ...args: any[]) {
  console.assert(assertion, msg, ...args);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(...data: any[]) {
  console.log(`${ts()}:`, ...data);
}

export function rand(n = 2) {
  return (Math.random() * 10 ** n).toFixed().toString().padStart(2, '0');
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
  let result = '';
  if (hours) {
    if (result) {
      result += ':';
    }
    result += timestamp.getHours().toString().padStart(2, '0');
  }
  if (minutes) {
    if (result) {
      result += ':';
    }
    result += timestamp.getMinutes().toString().padStart(2, '0');
  }
  if (seconds) {
    if (result) {
      result += ':';
    }
    result += timestamp.getSeconds().toString().padStart(2, '0');
  }
  if (ms) {
    if (result) {
      result += '.';
    }
    result += timestamp.getMilliseconds().toString().padStart(3, '0');
  }
  return result;
}
