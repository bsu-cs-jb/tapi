export async function sleep(ms: number = 10) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const namedMutex: Record<string, number> = {
  global: 0,
};

type MutexResult<T> = [T, true] | [undefined, false];

/**
 * Usage:
 *
 * const session:Session = { ... };
 * const result = await mutex<Session>(`file:${filename}`,
 *   async (): Promise<Session> => {
 *     return await writeFile<Session>(filename, data);
 * });
 * const session:Session = { };
 * const result = await mutex<Session>(`file:${filename}`,
 *   async (): Promise<Session> => {
 *     const buffer = jsonToBuffer(session);
 *     await writeFile(filename, buffer);
 *     return session;
 * });
 * console.log(`Wrote to ${filename}:`, result);
 */
export async function mutex<T>(
  name: string,
  method: () => Promise<T>,
  timeout: number = 5000,
): Promise<T> {
  const attempt = async (): Promise<MutexResult<T>> => {
    if (!(name in namedMutex)) {
      namedMutex[name] = 1;
    }
    // try to get a lock (>=)
    if (namedMutex[name] > 0) {
      // console.log(`Acquired mutex ${name}`);
      // if locks are available
      namedMutex[name] -= 1;
      // then do the action
      const result = await method();
      // release the lock
      // console.log(`Releasing mutex ${name}`);
      namedMutex[name] += 1;
      // and return success
      return [result, true];
    } else {
      // console.log(`Failed to acquire mutex ${name}`);
      return [undefined, false];
    }
  };
  const startTime = Date.now();
  let curTime = startTime;

  do {
    const result = await attempt();
    if (result[1]) {
      return result[0];
    }
    await sleep(50);
    curTime = Date.now();
  } while (curTime < startTime + timeout);

  throw new Error(`Failed to get mutex for '${name}' after ${timeout} ms.`);
}
