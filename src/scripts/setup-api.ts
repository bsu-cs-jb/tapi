import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import assert from "node:assert";

import * as _ from "lodash-es";
import { faker } from "@faker-js/faker";

import { AuthDb } from "../AuthDb.js";
import { IndecisiveClient, makeIndecisiveClient } from "../IndecisiveClient.js";
import { UserDb, makeUserDb } from "../IndecisiveTypes.js";
import { readFileAsJson } from "../FileDb.js";
import { config } from "../config.js";
import { info, error } from "./logging.js";
import { range, makeId } from "../utils.js";
import {
  Session,
  Suggestion,
  makeInvitation,
  makeSuggestion,
} from "../indecisive_rn_types.js";

const SERVER = config.TEST_SERVER;

interface UserDef {
  id: string;
  name: string;
  realname?: string;
  secret?: string;
  scopes?: string[];
  invite?: boolean;
}

function mkSuggest(
  name: string,
  upVoteUserIds: string[] = [],
  downVoteUserIds: string[] = [],
): Suggestion {
  return {
    id: makeId(name),
    name,
    upVoteUserIds,
    downVoteUserIds,
  };
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
  info(`  - creating user for ${user.id}`);
  const userDb = makeUserDb({
    id: user.id,
    name: user.name,
  });
  // info("Creating User:", userDb);
  try {
    const user_result = await client.createUser(userDb);
    // info("User Created:", user_result);
    return user_result;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // info("Client already exists, replacing instead.");
      const user_result = await client.updateUser(userDb);
      // info("User Created:", user_result);
      return user_result;
    } else {
      throw err;
    }
  }
}

async function updateCreateClient(
  user: UserDef,
  client: IndecisiveClient,
  currentSessionId: string = "cs411-final",
): Promise<AuthDb> {
  assert(client.token, "client.token must be defined");
  const authDb = authDbfromUser(user, currentSessionId);
  info(`  - creating client for ${user.id}`);
  // info("Creating Auth:", authDb);
  try {
    const dbClient = await client.createClient(authDb);
    // info("Client Created:", dbClient);
    return dbClient;
  } catch (err) {
    const message = (err as Error).message;
    if (message.match(/already exists/)) {
      // info("Client already exists, replacing instead.");
      const dbClient = await client.updateClient(authDb);
      // info("Client Created:", dbClient);
      return dbClient;
    } else {
      throw err;
    }
  }
}

async function clients(filename = "clients.private.json") {
  const rawUsers = await readFileAsJson(filename);
  const userDef = rawUsers as unknown as UserDef[];
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );
  info(`Setup token ${client.token}`);

  let createdUsers = 0;
  const MAX_USERS = 10;
  for (const user of userDef) {
    if (user.id === "jonathan") {
      break;
    }
    info(`User: ${user.id} ${user.name}`);
    await updateCreateClient(user, client);
    await updateCreateUser(user, client);
    if (user.invite || user.invite === undefined) {
      info(`  - invite user ${user.id} to session`);
      await client.invite("cs411-final", user.id);
    } else {
      info(`  - DO NOT invite user ${user.id} to session`);
    }
    createdUsers += 1;
    if (MAX_USERS > 0 && createdUsers > MAX_USERS) {
      break;
    }
  }
}

async function printIds(filename = "clients.private.json") {
  const rawUsers = await readFileAsJson(filename);
  const userDef = rawUsers as unknown as UserDef[];
  for (const user of userDef) {
    console.info(`clientId: ${user.id}\nclientSecret: ${user.secret}\n`);
  }
}

async function testUsers() {
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );

  const MAX_USERS = 101;
  for (const i in range(MAX_USERS)) {
    const id = `test-${i.padStart(3, "0")}`;
    const user: UserDef = {
      id,
      name: faker.person.firstName() + ` (${id})`,
    };
    info(`Will create user:`, user);
    await updateCreateUser(user, client);
  }
}

async function users() {
  const rawUsers = await readFileAsJson("users.json");
  const userNames = rawUsers as unknown as string[];
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );
  info(`Setup token ${client.token}`);

  let createdUsers = 0;
  const MAX_USERS = -1;
  for (const name of userNames) {
    const userId = makeId(name);
    info(`User: ${userId} ${name}`);

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

const GRADING_SESSION = "grading-session";

async function grading(_args: string[]) {
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );
  info(`Creating grading setup (token: ${client.token})`);

  info(`Creating client grader`);

  const graderDef: UserDef = {
    id: config.GRADER_ID,
    name: "Grader User",
    secret: config.GRADER_SECRET,
    invite: false,
  };

  info(`Deleting grading session if it exists: ${GRADING_SESSION}`);
  try {
    await client.deleteSession(GRADING_SESSION);
  } catch (error) {
    // ignore
  }

  info(`Creating grading session: ${GRADING_SESSION}`);
  await client.doFetch<Session>("POST", `/indecisive/sessions/`, {
    id: GRADING_SESSION,
    description: "Grading session",
    invitations: [
      makeInvitation({
        user: {
          id: "uat-001",
          name: "",
        },
        accepted: false,
        attending: "undecided",
      }),
      makeInvitation({
        user: {
          id: "uat-002",
          name: "",
        },
        accepted: true,
        attending: "yes",
      }),
      makeInvitation({
        user: {
          id: "uat-003",
          name: "",
        },
        accepted: true,
        attending: "no",
      }),
      makeInvitation({
        user: {
          id: "uat-004",
          name: "",
        },
        accepted: true,
        attending: "undecided",
      }),
    ],
    suggestions: [
      mkSuggest("pizza", ["uat-001"]),
      mkSuggest("popcorn", ["uat-001"], ["uat-002"]),
      mkSuggest("pop", [], ["uat-003"]),
      mkSuggest("fortnite", [], []),
    ],
  });

  info(`Creating grader client: ${GRADING_SESSION}`);
  await updateCreateClient(graderDef, client, GRADING_SESSION);
  info(`Creating grader user: ${GRADING_SESSION}`);
  await updateCreateUser(graderDef, client);
  info(`Inviting grader to session: ${GRADING_SESSION}`);
  await client.invite(GRADING_SESSION, graderDef.id);

  await client.invite(GRADING_SESSION, "uat-001");
  await client.invite(GRADING_SESSION, "uat-002");
  await client.invite(GRADING_SESSION, "uat-003");
  await client.invite(GRADING_SESSION, "uat-004");
}

async function gradingVotes() {
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );

  await client.vote(GRADING_SESSION, "pizza", "down");
}

async function main(args: string[]) {
  info("Args:", { args });
  info(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  info(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  const argsCopy = _.clone(args);

  // let arg: string|undefined;
  for (let arg = argsCopy.pop(); arg !== undefined; arg = argsCopy.pop()) {
    info(`Handling ${arg}`);
    switch (arg) {
      case "grading":
        await grading(argsCopy);
        break;
      case "grading-votes":
        await gradingVotes();
        break;
      case "users":
        await users();
        break;
      case "clients":
        await clients();
        break;
      case "student-clients":
        await clients("student-clients.private.json");
        break;
      case "print-student-ids":
        await printIds("student-clients.private.json");
        break;
      case "test-users":
        await testUsers();
        break;
      default:
        error(`Argument '${arg}' not understood`);
        break;
    }
  }
}

main(process.argv.slice(2))
  .then(() => {
    console.info("main finished");
  })
  .catch((err) => {
    error("Error running setup:main()", err);
  });
