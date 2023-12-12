import { expect, test, describe } from "@jest/globals";

import { makeSuggestion, makeSession } from "./indecisive_rn_types.js";
import {
  addInvitation,
  makeSessionDb,
  SessionDb,
  toSessionDb,
} from "./IndecisiveTypes.js";

describe("toSessionDb", () => {
  test("converts session to session db", () => {
    const ownerId = "owner-id";
    const selfId = "test-id";
    const session = makeSession({
      id: "session-id",
      owner: { id: ownerId, name: "" },
      accepted: true,
      attending: "no",
      invitations: [
        {
          user: {
            id: "test-1",
            name: "",
          },
          accepted: false,
          attending: "undecided",
        },
      ],
      suggestions: [
        makeSuggestion({
          id: "sugg-1",
          name: "Have a Sleep",
          downVoteUserIds: ["test-1"],
        }),
      ],
    });
    const newSessionDb: SessionDb = toSessionDb(session, selfId);
    expect(newSessionDb.id).toEqual(session.id);
    expect(newSessionDb.name).toEqual(session.description);
    expect(newSessionDb.ownerId).toEqual(ownerId);

    expect(newSessionDb.suggestions).toHaveLength(1);
    expect(newSessionDb.suggestions).toContainEqual({
      id: "sugg-1",
      name: "Have a Sleep",
      upVoteUserIds: [],
      downVoteUserIds: ["test-1"],
    });

    expect(newSessionDb.invitations).toHaveLength(2);
    expect(newSessionDb.invitations).toContainEqual({
      userId: "test-1",
      accepted: false,
      attending: "undecided",
    });
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: true,
      attending: "no",
    });
  });
});

describe("invitation", () => {
  test("addInvitation", () => {
    const selfId = "test-id";
    const newSessionDb: SessionDb = makeSessionDb({ ownerId: selfId });
    expect(newSessionDb.invitations).toHaveLength(0);

    addInvitation(newSessionDb, selfId);
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: false,
      attending: "undecided",
    });
    expect(newSessionDb.invitations).toHaveLength(1);

    addInvitation(newSessionDb, selfId);
    expect(newSessionDb.invitations).toHaveLength(1);
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: false,
      attending: "undecided",
    });

    addInvitation(newSessionDb, selfId, true, "undecided", true);
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: true,
      attending: "undecided",
    });

    addInvitation(newSessionDb, "new-id", true, "no");
    expect(newSessionDb.invitations).toHaveLength(2);
    expect(newSessionDb.invitations).toContainEqual({
      userId: "new-id",
      accepted: true,
      attending: "no",
    });
    expect(newSessionDb.invitations).toContainEqual({
      userId: selfId,
      accepted: true,
      attending: "undecided",
    });
  });
});
