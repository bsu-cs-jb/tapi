import { expect, test, describe, beforeAll } from "@jest/globals";

import { AuthDb } from "./AuthDb.js";
import { IndecisiveClient } from "./IndecisiveClient.js";

const SERVER = "http://localhost:3000";
// const SERVER = "http://cs411.duckdns.org";
const CLIENT_ID = "test";
const CLIENT_SECRET = "test";

const ADMIN_ID = "admin";
const ADMIN_SECRET = "admin";

const USER_ID = "test";
const USER_NAME = "Test User";

const SESSION_ID = "F0do6JsHtw";

function makeAuthDb(id: string, sessionId: string, scopes?: string[]): AuthDb {
  if (scopes === undefined) {
    scopes = ["read", "write"];
  }
  return {
    id,
    name: id,
    secret: "secret",
    client: {
      id,
      grants: ["client_credentials"],
    },
    user: {
      userId: id,
      currentSessionId: sessionId,
      scopes,
    },
  };
}

describe("/auth/clients", () => {
  let client: IndecisiveClient;

  beforeAll(async () => {
    client = new IndecisiveClient(SERVER);
    // await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  test("fails without authentication", async () => {
    const authDb = makeAuthDb("at-001", SESSION_ID);
    await expect(client.createClient(authDb)).rejects.toThrow("401");
  });

  test("fails without admin authentication", async () => {
    await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
    const authDb = makeAuthDb("at-001", SESSION_ID);
    await expect(client.createClient(authDb)).rejects.toThrow("403");
  });

  test("requires admin authentication", async () => {
    await client.fetchToken(ADMIN_ID, ADMIN_SECRET, "admin");
    try {
      await client.deleteClient("at-001");
    } catch {
      // do nothing
    }
    try {
      const authDb = makeAuthDb("at-001", SESSION_ID);
      const result = await client.createClient(authDb);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("id", "at-001");
      expect(result).toHaveProperty("name", "at-001");
    } finally {
      await client.deleteClient("at-001");
    }
  });
});
