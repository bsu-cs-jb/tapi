import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import { AuthDb } from "./AuthDb.js";
import { createClient, updateClient } from "./AuthClient.js";
import { fetchToken } from "./ApiClient.js";
import { createUser, updateUser, invite } from "./IndecisiveClient.js";
import { UserDb, makeUserDb } from "./IndecisiveTypes.js";
import { readFileAsJson } from "./FileDb.js";
import { config } from "./config.js";
import { log, logger } from "./logging.js";
// import { hash } from "./hash.js";
import { range } from "./utils.js";
import { faker } from "@faker-js/faker";

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

async function updateCreateUser(user: UserDef, token: string): Promise<UserDb> {
  log(`  - creating user for ${user.id}`);
  const userDb = makeUserDb({
    id: user.id,
    name: user.name,
  });
  // log("Creating User:", userDb);
  try {
    const user_result = await createUser(userDb, token);
    // log("User Created:", user_result);
    return user_result;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // log("Client already exists, replacing instead.");
      const user_result = await updateUser(userDb, token);
      // log("User Created:", user_result);
      return user_result;
    } else {
      throw err;
    }
  }
}

async function updateCreateClient(user: UserDef): Promise<AuthDb> {
  const authDb = authDbfromUser(user, "cs411-final");
  log(`  - creating client for ${user.id}`);
  // log("Creating Auth:", authDb);
  try {
    const client = await createClient(authDb);
    // log("Client Created:", client);
    return client;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // log("Client already exists, replacing instead.");
      const client = await updateClient(authDb);
      // log("Client Created:", client);
      return client;
    } else {
      throw err;
    }
  }
}

async function users() {
  // need session id
  const rawUsers = await readFileAsJson("users.private.json");
  const userDef = rawUsers as unknown as UserDef[];
  const token = await fetchToken(config.ADMIN_ID, config.ADMIN_SECRET, "admin");
  log(`Setup token ${token}`);

  let createdUsers = 0;
  const MAX_USERS = -1;
  for (const user of userDef) {
    log(`User: ${user.id} ${user.name}`);
    await updateCreateClient(user);
    await updateCreateUser(user, token);
    if (user.invite || user.invite === undefined) {
      log(`  - invite user ${user.id} to session`);
      await invite("cs411-final", user.id, token);
    } else {
      log(`  - DO NOT invite user ${user.id} to session`);
    }
    createdUsers += 1;
    if (MAX_USERS > 0 && createdUsers > MAX_USERS) {
      break;
    }
  }
}

async function fakeUsers() {
  // need session id
  const token = await fetchToken(config.ADMIN_ID, config.ADMIN_SECRET, "admin");
  log(`Setup token ${token}`);

  const MAX_USERS = 99;
  for (const i in range(MAX_USERS)) {
    const user: UserDef = {
      id: `test-${i.padStart(3, "0")}`,
      name: faker.person.firstName(),
    };
    log(`Will create user:`, user);
    await updateCreateUser(user, token);
  }
}

async function main() {
  console.log("Doing work");
  log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  log(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  await users();
  await fakeUsers();
}

main()
  .then(() => {
    console.log("main finished");
  })
  .catch((err) => {
    logger.error("Error running setup:main()", err);
  });
