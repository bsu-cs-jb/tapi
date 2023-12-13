import { expect, test, describe, beforeEach, afterEach } from "@jest/globals";

import { makeUserDb } from "./IndecisiveTypes.js";
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

async function deleteToken(token: string, adminToken?: string) {
  const client = new IndecisiveClient(SERVER);
  let tempToken;
  let cleanupToken = true;
  if (adminToken) {
    tempToken = adminToken;
    cleanupToken = false;
  } else {
    tempToken = await client.fetchToken(ADMIN_ID, ADMIN_SECRET, "admin");
  }
  try {
    await client.deleteToken(token);
  } catch {
    // nothing
  }
  if (cleanupToken) {
    try {
      await client.deleteToken(tempToken);
    } catch {
      // nothing
    }
  }
}

describe("/auth/clients", () => {
  let client: IndecisiveClient;

  beforeEach(async () => {
    client = new IndecisiveClient(SERVER);
    // await client.fetchToken(CLIENT_ID, CLIENT_SECRET);
  });

  afterEach(async () => {
    if (client && client.token && client.token !== "MISSING") {
      await deleteToken(client.token);
      client.token = "MISSING";
    }
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

  test("updates secret", async () => {
    const adminToken = await client.fetchToken(ADMIN_ID, ADMIN_SECRET, "admin");
    const clientId = "at-002";
    try {
      await client.deleteClient(clientId);
    } catch {
      // do nothing
    }
    try {
      const authDb = makeAuthDb(clientId, SESSION_ID);
      let result = await client.createClient(authDb);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("id", clientId);
      expect(result).toHaveProperty("client.id", clientId);
      expect(result).toHaveProperty("user.userId", clientId);
      try {
        await client.createUser(
          makeUserDb({
            id: clientId,
            name: clientId,
          }),
        );
      } catch {
        // nothing
      }
      const userClient1 = new IndecisiveClient(SERVER);
      const userToken = await userClient1.fetchToken(clientId, "secret");
      let self = await userClient1.self();
      expect(self).toHaveProperty("id", clientId);

      authDb.secret = "different";
      result = await client.updateClient(authDb);
      expect(result).toHaveProperty("id", clientId);
      expect(result).toHaveProperty("client.id", clientId);
      expect(result).toHaveProperty("user.userId", clientId);
      const userClient2 = new IndecisiveClient(SERVER);
      const userToken2 = await userClient2.fetchToken(clientId, "different");
      self = await userClient2.self();
      expect(self).toHaveProperty("id", clientId);

      await client.deleteToken(userToken);
      await client.deleteToken(userToken2);
    } finally {
      await client.deleteClient(clientId);
      await client.deleteUser(clientId);
    }
  });
});
