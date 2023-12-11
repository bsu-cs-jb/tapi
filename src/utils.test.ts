import { expect, test, describe, beforeEach } from '@jest/globals';

import { cycle } from "./utils.js";

describe('cycle', () => {
  test('gets next item', () => {
    const list = ["A","B","C","B"];
    expect(cycle(list)).toBe("A");
  });
});
