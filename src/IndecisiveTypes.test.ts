import { expect, test, describe } from "@jest/globals";

import { makeSessionDb, SessionDb } from "./IndecisiveTypes.js";

describe("invitation", () => {
  test("addInvitation", () => {
    const session: SessionDb = makeSessionDb({});
    expect(session).toHaveProperty("id");
  });
});
