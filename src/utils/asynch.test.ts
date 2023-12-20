import { expect, test, describe, beforeEach, afterEach } from "@jest/globals";

import { mutex, sleep } from "./asynch.js";
import { urlid } from "./genid.js";

describe("mutex", () => {
  beforeEach(async () => {
    // IDK
  });

  afterEach(async () => {
    // IDK
  });

  test("can get a lock", async () => {
    const lock = urlid();
    const order: [Date, string][] = [];
    function event(message: string) {
      const ts = new Date();
      // console.log(`${ts.toISOString()} ${message}`);
      order.push([ts, message]);
    }

    const bob = async () => {
      // console.log("bob sleep");
      await sleep(1);
      // console.log("bob awake");
      const result = await mutex(lock, async () => {
        event("bob lock sleep");
        await sleep(700);
        event("bob lock done");
        return "bob";
      });
      // console.log("bob done");
      return result;
    };

    const mary = async () => {
      // console.log("mary sleep");
      await sleep(300);
      // console.log("mary awake");
      const result = await mutex(lock, async () => {
        event("mary lock sleep");
        await sleep(10);
        event("mary lock done");
        return "mary";
      });
      // console.log("mary done");
      return result;
    };

    const result = await Promise.all([mary(), bob()]);

    expect(result).toEqual(["mary", "bob"]);
    expect(order.map((o) => o[1])).toEqual([
      "bob lock sleep",
      "bob lock done",
      "mary lock sleep",
      "mary lock done",
    ]);
  });

  test("lock attempt times out", async () => {
    const lock = urlid();
    const order: [Date, string][] = [];
    function event(message: string) {
      const ts = new Date();
      // console.log(`${ts.toISOString()} ${message}`);
      order.push([ts, message]);
    }

    const bob = async () => {
      // console.log("bob sleep");
      await sleep(1);
      // console.log("bob awake");
      const result = await mutex(lock, async () => {
        event("bob lock sleep");
        await sleep(700);
        event("bob lock done");
        return "bob";
      });
      // console.log("bob done");
      return result;
    };

    const mary = async () => {
      // console.log("mary sleep");
      await sleep(300);
      // console.log("mary awake");
      const result = await mutex(
        lock,
        async () => {
          event("mary lock sleep");
          await sleep(10);
          event("mary lock done");
          return "mary";
        },
        100,
      );
      // console.log("mary done");
      return result;
    };

    const result = await Promise.allSettled([mary(), bob()]);

    expect(result[0].status).toEqual("rejected");
    expect(result[1]).toEqual({
      status: "fulfilled",
      value: "bob",
    });
    expect(order.map((o) => o[1])).toEqual(["bob lock sleep", "bob lock done"]);
  });
});
