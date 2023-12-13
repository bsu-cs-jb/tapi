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

import { IndecisiveClient } from "./IndecisiveClient.js";

import { base64 } from "./utils.js";

import { config } from "./config.js";
const SERVER = config.TEST_SERVER;

const CLIENT_ID = "test";
const CLIENT_SECRET = "test";

const USER_ID = "test";
const USER_NAME = "Test User";

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
    const client = new IndecisiveClient(SERVER);
    await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
    const result = await client.self();
    expect(result).toBeDefined();
    // more detailed expectations inthe tests below
  });
});

describe("/self", () => {
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = new IndecisiveClient(SERVER);
    await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  test("responds with self", async () => {
    const result = await client.self();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id", USER_ID);
    expect(result).toHaveProperty("name", USER_NAME);
  });

  test("supertest works", async () => {
    const req = request(SERVER);
    const result = await req
      .get("/indecisive/self")
      .auth(client.token || "", { type: "bearer" })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", USER_ID);
    expect(result.body).toHaveProperty("name", USER_NAME);
  });
});

describe("/current-session", () => {
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = new IndecisiveClient(SERVER);
    await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
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

  test("works", async () => {
    const req = request(SERVER);
    const result = await req
      .post(`/indecisive/sessions/${sessionId}/invite`)
      .auth(token, { type: "bearer" })
      .send({ userId: "brahbrah" })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", sessionId);
    expect(result.body.invitations).toContainEqual({
      user: {
        id: "brahbrah",
        name: "Brahbrah",
      },
      accepted: false,
      attending: "undecided",
    });
  });
});

describe("/session/invite", () => {
  let sessionId = "";
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = new IndecisiveClient(SERVER);
    await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
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

  test("works", async () => {
    const result = await client.invite(sessionId, "brahbrah");

    expect(result).toBeDefined();
    expect(result).toHaveProperty("id", sessionId);
    expect(result.invitations).toContainEqual({
      user: {
        id: "brahbrah",
        name: "Brahbrah",
      },
      accepted: false,
      attending: "undecided",
    });
    expect(result).toHaveProperty("accepted", true);
    expect(result).toHaveProperty("attending", "yes");
  });
});
