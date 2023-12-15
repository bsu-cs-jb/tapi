import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import assert from "node:assert";
import * as _ from "lodash-es";

import { AuthDb } from "./AuthDb.js";
import { IndecisiveClient } from "./IndecisiveClient.js";
import { UserDb, makeUserDb } from "./IndecisiveTypes.js";
import { readFileAsJson } from "./FileDb.js";
import { config } from "./config.js";
import { log, logger } from "./logging.js";
// import { hash } from "./hash.js";
import { range, makeId } from "./utils.js";
import { faker } from "@faker-js/faker";

const SERVER = config.TEST_SERVER;

interface UserDef {
  id: string;
  name: string;
  realname?: string;
  secret?: string;
  scopes?: string[];
  invite?: boolean;
}

function authDbfromUser(user: UserDef, sessionId: string): AuthDb {
  let scopes = ["read", "write"];
  if (user.scopes !== undefined) {
    scopes = user.scopes;
  }
  return {
    id: user.id,
    name: user.name,
    secret: user.secret || "",
    client: {
      id: user.id,
      grants: ["client_credentials"],
    },
    user: {
      userId: user.id,
      currentSessionId: sessionId,
      scopes,
    },
  };
}

async function updateCreateUser(
  user: UserDef,
  client: IndecisiveClient,
): Promise<UserDb> {
  log(`  - creating user for ${user.id}`);
  const userDb = makeUserDb({
    id: user.id,
    name: user.name,
  });
  // log("Creating User:", userDb);
  try {
    const user_result = await client.createUser(userDb);
    // log("User Created:", user_result);
    return user_result;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // log("Client already exists, replacing instead.");
      const user_result = await client.updateUser(userDb);
      // log("User Created:", user_result);
      return user_result;
    } else {
      throw err;
    }
  }
}

async function updateCreateClient(
  user: UserDef,
  client: IndecisiveClient,
): Promise<AuthDb> {
  assert(client.token, "client.token must be defined");
  const authDb = authDbfromUser(user, "cs411-final");
  log(`  - creating client for ${user.id}`);
  // log("Creating Auth:", authDb);
  try {
    const dbClient = await client.createClient(authDb);
    // log("Client Created:", dbClient);
    return dbClient;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // log("Client already exists, replacing instead.");
      const dbClient = await client.updateClient(authDb);
      // log("Client Created:", dbClient);
      return dbClient;
    } else {
      throw err;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function clients() {
  // need session id
  const rawUsers = await readFileAsJson("clients.private.json");
  const userDef = rawUsers as unknown as UserDef[];
  const client = new IndecisiveClient(SERVER);
  await client.fetchToken(config.ADMIN_ID, config.ADMIN_SECRET, "admin");
  log(`Setup token ${client.token}`);

  let createdUsers = 0;
  const MAX_USERS = 3;
  for (const user of userDef) {
    if (user.id === "jonathan") {
      break;
    }
    log(`User: ${user.id} ${user.name}`);
    await updateCreateClient(user, client);
    await updateCreateUser(user, client);
    if (user.invite || user.invite === undefined) {
      log(`  - invite user ${user.id} to session`);
      await client.invite("cs411-final", user.id);
    } else {
      log(`  - DO NOT invite user ${user.id} to session`);
    }
    createdUsers += 1;
    if (MAX_USERS > 0 && createdUsers > MAX_USERS) {
      break;
    }
  }
}

async function printIds() {
  const rawUsers = await readFileAsJson("clients.private.json");
  const userDef = rawUsers as unknown as UserDef[];
  for (const user of userDef) {
    console.log(`clientId: ${user.id}\nclientSecret: ${user.secret}\n`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fakeUsers() {
  const client = new IndecisiveClient(SERVER);
  await client.fetchToken(config.ADMIN_ID, config.ADMIN_SECRET, "admin");

  const MAX_USERS = 99;
  for (const i in range(MAX_USERS)) {
    const user: UserDef = {
      id: `test-${i.padStart(3, "0")}`,
      name: faker.person.firstName(),
    };
    log(`Will create user:`, user);
    await updateCreateUser(user, client);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function users() {
  // need session id
  const rawUsers = await readFileAsJson("users.json");
  const userNames = rawUsers as unknown as string[];
  const client = new IndecisiveClient(SERVER);
  await client.fetchToken(config.ADMIN_ID, config.ADMIN_SECRET, "admin");
  log(`Setup token ${client.token}`);

  let createdUsers = 0;
  const MAX_USERS = -1;
  for (const name of userNames) {
    const userId = makeId(name);
    log(`User: ${userId} ${name}`);

    await updateCreateUser(
      {
        id: userId,
        name,
      },
      client,
    );
    createdUsers += 1;
    if (MAX_USERS > 0 && createdUsers > MAX_USERS) {
      break;
    }
  }
}

async function main() {
  console.log("Doing work");
  log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  log(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  await users();
  // await clients();
  // await fakeUsers();
  // await printIds();
}

main()
  .then(() => {
    console.log("main finished");
  })
  .catch((err) => {
    logger.error("Error running setup:main()", err);
  });
