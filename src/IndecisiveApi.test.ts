import {
  expect,
  test,
  describe,
  beforeAll,
  beforeEach,
  afterEach,
} from "@jest/globals";

import request from "supertest";

import { Session } from "./indecisive_rn_types.js";

import { fetchToken } from "./ApiClient.js";

import { base64 } from "./utils.js";

const URL = "http://localhost:3000";
// const URL = "http://cs411.duckdns.org";
const CLIENT_ID = "test";
const CLIENT_SECRET = "test";

const USER_ID = "test";
const USER_NAME = "Test User";

const SESSION_ID = "F0do6JsHtw";

async function deleteSession(
  token: string,
  sessionId: string,
): Promise<object> {
  const result = await fetch(`${URL}/indecisive/sessions/${sessionId}`, {
    method: "DELETE",
    headers: new Headers({
      Authorization: `Bearer ${token}`,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      return json as object;
    });
  return result;
}

async function createSession(token: string): Promise<Session> {
  const result = await fetch(`${URL}/indecisive/sessions`, {
    method: "POST",
    body: JSON.stringify({
      description: "UAT Session",
    }),
    headers: new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      return json as Session;
    });
  return result;
}

describe("auth", () => {
  test("generates token", async () => {
    const result = await fetch(`${URL}/token`, {
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
    const req = request(URL);
    await req.get("/indecisive/self").expect(401);
  });

  test("fails without token", async () => {
    await fetch(`${URL}/indecisive/self`, {}).then((response) => {
      expect(response).toHaveProperty("status", 401);
    });
  });

  test("uses token", async () => {
    const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
    const result = await fetch(`${URL}/indecisive/self`, {
      headers: new Headers({
        Authorization: `Bearer ${token}`,
      }),
    }).then((response) => {
      expect(response).toHaveProperty("status", 200);
      expect(response).toHaveProperty("ok", true);
      return response.json();
    });
    expect(result).toBeDefined();
    // more detailed expectations inthe tests below
  });
});

describe("/self", () => {
  let token = "EMPTY";

  beforeAll(async () => {
    token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  test("works", async () => {
    const result = await fetch(`${URL}/indecisive/self`, {
      headers: new Headers({
        Authorization: `Bearer ${token}`,
      }),
    }).then((response) => {
      expect(response).toHaveProperty("status", 200);
      expect(response).toHaveProperty("ok", true);
      return response.json();
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id", USER_ID);
    expect(result).toHaveProperty("name", USER_NAME);
  });

  test("supertest works", async () => {
    const req = request(URL);
    const result = await req
      .get("/indecisive/self")
      .auth(token, { type: "bearer" })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", USER_ID);
    expect(result.body).toHaveProperty("name", USER_NAME);
  });
});

describe("/current-session", () => {
  let token = "EMPTY";

  beforeAll(async () => {
    token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  test("works", async () => {
    const result = await fetch(`${URL}/indecisive/current-session`, {
      headers: new Headers({
        Authorization: `Bearer ${token}`,
      }),
    }).then((response) => {
      expect(response).toHaveProperty("status", 200);
      expect(response).toHaveProperty("ok", true);
      return response.json();
    });
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

  beforeAll(async () => {
    token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  test("works", async () => {
    const req = request(URL);
    const result = await req
      .post(`/indecisive/sessions/${SESSION_ID}/invite`)
      .auth(token, { type: "bearer" })
      .send({ userId: "brahbrah" })
      .expect(200)
      .expect("Content-Type", /json/);
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty("id", SESSION_ID);
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
  let token = "EMPTY";
  let sessionId = "";

  beforeAll(async () => {
    token = await fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  beforeEach(async () => {
    const session = await createSession(token);
    sessionId = session.id;
  });

  afterEach(async () => {
    await deleteSession(token, sessionId);
  });

  test("works", async () => {
    const req = request(URL);
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
    expect(result.body).toHaveProperty("accepted", true);
    expect(result.body).toHaveProperty("attending", "yes");
  });
});
