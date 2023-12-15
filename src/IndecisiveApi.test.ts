import {
  expect,
  test,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";

import request from "supertest";

import { Session, Suggestion } from "./indecisive_rn_types.js";
import { IndecisiveClient, makeIndecisiveClient } from "./IndecisiveClient.js";
import { sendData } from "./ApiClient.js";

import { base64 } from "./utils.js";

import { config } from "./config.js";
const SERVER = config.TEST_SERVER;

const CLIENT_ID = config.TEST_USER1_ID;
const CLIENT_SECRET = config.TEST_USER1_SECRET;

const CLIENT_2_ID = config.TEST_USER2_ID;
const CLIENT_2_SECRET = config.TEST_USER2_SECRET;

const USER_1_ID = config.TEST_USER1_ID;
const USER_1_NAME = "Unit Test 1";

const USER_2_ID = config.TEST_USER2_ID;
const USER_2_NAME = "Unit Test 2";

describe("auth", () => {
  test("generates token", async () => {
    const result = await fetch(`${SERVER}/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${base64(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      }),
    }).then((response) => {
      expect(response).toHaveProperty("status", 200);
      expect(response).toHaveProperty("ok", true);
      return response.json();
    });
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("token_type", "Bearer");
    expect(result).toHaveProperty("scope");
    expect(result).toHaveProperty("expires_in");
  });

  test("supertest fails without token", async () => {
    const req = request(SERVER);
    await req.get("/indecisive/self").expect(401);
  });

  test("fails without token", async () => {
    await fetch(`${SERVER}/indecisive/self`, {}).then((response) => {
      expect(response).toHaveProperty("status", 401);
    });
  });

  test("uses token", async () => {
    const client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
    const result = await client.self();
    expect(result).toBeDefined();
    // more detailed expectations inthe tests below
  });
});

describe("/self", () => {
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
  });

  test("responds with self", async () => {
    const result = await client.self();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id", USER_1_ID);
    expect(result).toHaveProperty("name", USER_1_NAME);
  });

  test("supertest works", async () => {
    const req = request(SERVER);
    const result = await req
      .get("/indecisive/self")
      .auth(client.token || "", { type: "bearer" })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", USER_1_ID);
    expect(result.body).toHaveProperty("name", USER_1_NAME);
  });
});

describe("/current-session", () => {
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
  });

  test("works", async () => {
    const result = await client.currentSession();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("accepted");
    expect(result).toHaveProperty("attending");
    expect(result).toHaveProperty("invitations");
    expect(result).toHaveProperty("suggestions");
  });
});

describe("/session/invite", () => {
  let token = "EMPTY";
  let sessionId = "";
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = new IndecisiveClient(SERVER);
    token = await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
    const session = await client.createSession("UAT Testing");
    sessionId = session.id;
  });

  afterAll(async () => {
    await client.deleteSession(sessionId);
  });

  test("adds an invitation for a user", async () => {
    const req = request(SERVER);
    const result = await req
      .post(`/indecisive/sessions/${sessionId}/invite`)
      .auth(token, { type: "bearer" })
      .send({ userId: USER_2_ID })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", sessionId);
    expect(result.body.invitations).toContainEqual({
      user: {
        id: USER_2_ID,
        name: USER_2_NAME,
      },
      accepted: false,
      attending: "undecided",
    });
  });
});

describe("/session/respond", () => {
  let session: Session | undefined;
  let client: IndecisiveClient;
  let client2: IndecisiveClient;

  beforeAll(async () => {
    client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
    client2 = await makeIndecisiveClient(SERVER, CLIENT_2_ID, CLIENT_2_SECRET);
  });

  beforeEach(async () => {
    session = await client.createSession("UAT Testing");
    session = await client.invite(session.id, USER_2_ID);
  });

  afterEach(async () => {
    if (session) {
      try {
        await client.deleteSession(session.id);
      } catch {
        // nothing
      }
      session = undefined;
    }
  });

  test("updates response for a user", async () => {
    if (!session) {
      expect(session).toBeDefined();
      return;
    }
    expect(session).toHaveProperty("accepted", true);
    expect(session).toHaveProperty("attending", "yes");
    expect(session.invitations).toContainEqual({
      user: {
        id: USER_2_ID,
        name: USER_2_NAME,
      },
      accepted: false,
      attending: "undecided",
    });

    // Owner updates their own status
    let result = await client.respond(session.id, true, "undecided");
    expect(result).toHaveProperty("id", session.id);
    expect(result).toHaveProperty("accepted", true);
    expect(result).toHaveProperty("attending", "undecided");

    // User 2's view of the session is different
    result = await client2.session(session.id);
    expect(result).toHaveProperty("id", session.id);
    expect(result).toHaveProperty("accepted", false);
    expect(result).toHaveProperty("attending", "undecided");

    result = await client2.respond(session.id, true, "no");

    expect(result).toHaveProperty("id", session.id);
    expect(result).toHaveProperty("accepted", true);
    expect(result).toHaveProperty("attending", "no");

    expect(result.invitations).toContainEqual({
      user: {
        id: USER_1_ID,
        name: USER_1_NAME,
      },
      accepted: true,
      attending: "undecided",
    });

    // User 1's view of the session
    result = await client.session(session.id);
    expect(result).toHaveProperty("id", session.id);
    expect(result).toHaveProperty("accepted", true);
    expect(result).toHaveProperty("attending", "undecided");

    expect(result.invitations).toContainEqual({
      user: {
        id: USER_2_ID,
        name: USER_2_NAME,
      },
      accepted: true,
      attending: "no",
    });
  });
});

describe("/session/vote", () => {
  let session: Session | undefined;
  let client: IndecisiveClient;
  let suggestion: Suggestion | undefined;

  beforeAll(async () => {
    client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
  });

  beforeEach(async () => {
    session = await client.createSession("UAT Testing");
    session = await client.addSuggestion(session.id, "Take a hike");
    suggestion = session?.suggestions[0];
  });

  afterEach(async () => {
    if (session) {
      try {
        await client.deleteSession(session.id);
      } catch {
        // nothing
      }
      session = undefined;
    }
  });

  test("suggestion starts with no votes", async () => {
    if (!session || !suggestion) {
      expect(session).toBeDefined();
      expect(suggestion).toBeDefined();
      return;
    }
    expect(suggestion).toEqual({
      id: suggestion.id,
      name: "Take a hike",
      upVoteUserIds: [],
      downVoteUserIds: [],
    });
  });

  test("accepts PUT", async () => {
    if (!session || !suggestion) {
      expect(session).toBeDefined();
      expect(suggestion).toBeDefined();
      return;
    }
    const result = await sendData<Session>(
      "PUT",
      `/indecisive/sessions/${session.id}/vote/${suggestion.id}`,
      { vote: "down" },
      client.server,
      client.token,
    );

    expect(result).toHaveProperty("id", session.id);
    expect(result.suggestions).toContainEqual({
      id: suggestion.id,
      name: "Take a hike",
      downVoteUserIds: [USER_1_ID],
      upVoteUserIds: [],
    });
  });

  test("can change vote to none", async () => {
    if (!session || !suggestion) {
      expect(session).toBeDefined();
      expect(suggestion).toBeDefined();
      return;
    }

    let result = await client.vote(session.id, suggestion.id, "up");

    expect(result).toHaveProperty("id", session.id);
    expect(result.suggestions).toContainEqual({
      id: suggestion.id,
      name: "Take a hike",
      upVoteUserIds: [USER_1_ID],
      downVoteUserIds: [],
    });

    result = await client.vote(session.id, suggestion.id, "none");

    expect(result).toHaveProperty("id", session.id);
    expect(result.suggestions).toContainEqual({
      id: suggestion.id,
      name: "Take a hike",
      upVoteUserIds: [],
      downVoteUserIds: [],
    });
  });

  test("votes up", async () => {
    if (!session || !suggestion) {
      expect(session).toBeDefined();
      expect(suggestion).toBeDefined();
      return;
    }
    expect(suggestion).toHaveProperty("name", "Take a hike");
    const result = await client.vote(session?.id, suggestion.id, "up");

    expect(result).toBeDefined();
    expect(result).toHaveProperty("id", session.id);
    expect(result.suggestions).toContainEqual({
      id: suggestion.id,
      name: "Take a hike",
      upVoteUserIds: [USER_1_ID],
      downVoteUserIds: [],
    });
  });
});

describe("/session/invite", () => {
  let sessionId = "";
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = await makeIndecisiveClient(SERVER, CLIENT_ID, CLIENT_SECRET);
  });

  beforeEach(async () => {
    const session = await client.createSession("UAT Testing");
    sessionId = session.id;
  });

  afterEach(async () => {
    try {
      await client.deleteSession(sessionId);
    } catch {
      // nothing
    }
  });

  test("adds an invitation to the session", async () => {
    const result = await client.invite(sessionId, USER_2_ID);

    expect(result).toHaveProperty("id", sessionId);
    expect(result.invitations).toContainEqual({
      user: {
        id: USER_2_ID,
        name: USER_2_NAME,
      },
      accepted: false,
      attending: "undecided",
    });
    expect(result).toHaveProperty("accepted", true);
    expect(result).toHaveProperty("attending", "yes");
  });
});
