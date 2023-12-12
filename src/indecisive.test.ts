import { expect, test, describe } from "@jest/globals";
import { Context, Next } from "koa";

import {
  Session,
  Attending,
  Vote,
  Invitation,
  Suggestion,
} from "./indecisive_rn_types.js";
import {
  toSession,
  toSessionDb,
  addInvitation,
  getSuggestion,
  updateResponse,
  getInvitation,
  addSuggestion,
  updateSuggestion,
  canViewSession,
  UserDb,
  SessionDb,
} from "./IndecisiveTypes.js";
import { FOR_TESTING } from "./indecisive.js";

describe("preCreateSession", () => {
  test("does not duplicate invitations", async () => {
    const selfId = "my-id";
    const newSessionDb = await FOR_TESTING.preCreateSession(
      {
        state: { self: { id: selfId } },
      } as Context,
      {} as SessionDb,
      { description: "Test Desc" } as Session,
    );
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: true,
      attending: "yes",
    });
    expect(newSessionDb.ownerId === selfId);
    expect(newSessionDb.invitations).toHaveLength(1);
    addInvitation(newSessionDb, selfId);
    expect(newSessionDb.invitations).toHaveLength(1);
  });

  test("respects body parameters", async () => {
    const selfId = "my-id";
    const newSessionDb = await FOR_TESTING.preCreateSession(
      {
        state: { self: { id: selfId } },
      } as Context,
      {} as SessionDb,
      { description: "Test Desc", accepted: true, attending: "no" } as Session,
    );
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: true,
      attending: "no",
    });
    expect(newSessionDb.invitations).toHaveLength(1);
    addInvitation(newSessionDb, selfId);
    expect(newSessionDb.invitations).toHaveLength(1);
  });
});
