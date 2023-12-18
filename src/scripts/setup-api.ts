import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import assert from "node:assert";

import * as _ from "lodash-es";
import { faker } from "@faker-js/faker";

import { AuthDb } from "../AuthDb.js";
import { FetchError } from "../ApiClient.js";
import { IndecisiveClient, makeIndecisiveClient } from "../IndecisiveClient.js";
import { UserDb, makeUserDb } from "../IndecisiveTypes.js";
import { readFileAsJson } from "../FileDb.js";
import { config } from "../config.js";
import { info, error } from "./logging.js";
import { range, makeId } from "../utils.js";
import {
  Suggestion,
  makeInvitation,
  Attending,
  Vote,
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
  id?: string,
): Suggestion {
  return {
    id: id || makeId(name),
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
    const result = await client.deleteSession(GRADING_SESSION);
    info(`Deleted existing grading session.`, { result });
  } catch (e) {
    // ignore 404s
    const err = e as FetchError;
    if (err.status !== 404) {
      error(`Failed deleting grading session ${error}`, err);
    }
  }

  info(`Creating grading session: ${GRADING_SESSION}`);
  await client.createSession(
    {
      id: GRADING_SESSION,
      description: "Grading session",
      accepted: true,
      attending: "yes",
      invitations: [
        makeInvitation({
          user: {
            id: "uat-002",
            name: "",
          },
          accepted: false,
          attending: "undecided",
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
        mkSuggest("Pizza", ["uat-001"]),
        mkSuggest("Popcorn", ["uat-001"], ["uat-004"]),
        mkSuggest("Pop", [], ["uat-003"]),
        mkSuggest("Fortnite", [], []),
        mkSuggest(
          "We should really get together and just laugh until we puke",
          [],
          [],
          "long",
        ),
      ],
    },
    {
      headers: { "X-Tapi-UserId": "uat-001" },
    },
  );

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

  info(`Updating grading suggestions and votes (token: ${client.token})`);

  const suggestName = "Grading a bunch of assignments";
  info(`Adding suggestion: ${suggestName}`);
  const session = await client.suggest(
    GRADING_SESSION,
    "Grading a bunch of assignments",
    {
      headers: { "X-Tapi-UserId": "grader" },
    },
  );
  const newSuggestion = _.find(session.suggestions, { name: suggestName });
  assert(newSuggestion, "Must find new suggestion.");

  const votes: [string, string, Vote][] = [
    ["uat-001", "fortnite", "down"],
    ["uat-002", "fortnite", "down"],
    ["uat-003", "fortnite", "down"],
    ["uat-004", "fortnite", "down"],
    ["uat-001", newSuggestion.id, "up"],
    ["uat-002", newSuggestion.id, "down"],
    ["uat-003", newSuggestion.id, "up"],
    ["uat-004", newSuggestion.id, "down"],
    // grader votes every suggestion down
    ...session.suggestions.map((s): [string, string, Vote] => [
      "grader",
      s.id,
      (s.id === "fortnite" ? "none" : "down") as Vote,
    ]),
  ];

  for (const [userId, suggestionId, vote] of votes) {
    const name = ((sugg) => (sugg ? sugg.name : "MISSING"))(
      _.find(session.suggestions, { id: suggestionId }),
    );
    info(`User ${userId} voting ${vote} on ${suggestionId}: ${name}`);
    await client.vote(GRADING_SESSION, suggestionId, vote, {
      headers: { "X-Tapi-UserId": userId },
    });
  }
}

async function gradingInvites() {
  const client = await makeIndecisiveClient(
    SERVER,
    config.ADMIN_ID,
    config.ADMIN_SECRET,
    "admin",
  );
  info(`Updating grading invites (token: ${client.token})`);

  let session = await client.session(GRADING_SESSION);

  const responses: [string, boolean, Attending][] = [
    ["test-025", true, "no"],
    ["test-011", true, "yes"],
    ["test-083", true, "undecided"],
    ["test-027", false, "yes"],
  ];

  for (const [userId, accept, attend] of responses) {
    if (!_.find(session.invitations, { user: { id: userId } })) {
      info(`Inviting ${userId} to grading session.`);
      await client.invite(GRADING_SESSION, userId);
    }
    info(`${userId} responding: ${accept} ${attend}`);
    session = await client.respond(GRADING_SESSION, accept, attend, {
      headers: { "X-Tapi-UserId": userId },
    });
  }

  session = await client.respond(GRADING_SESSION, false, "no", {
    headers: { "X-Tapi-UserId": "grader" },
  });
}

async function main(args: string[]) {
  info(`Args: ${args.join(", ")}`);
  info(`SERVER: ${config.TEST_SERVER}`);

  const argsCopy = _.clone(args);

  for (let arg = argsCopy.shift(); arg !== undefined; arg = argsCopy.shift()) {
    info(`Handling ${arg}`);
    switch (arg) {
      case "grading-1-init":
        await grading(argsCopy);
        break;
      case "grading-2-votes":
        await gradingVotes();
        break;
      case "grading-3-invites":
        await gradingInvites();
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

  info(`Finished running ${config.TEST_SERVER} ${args.join(", ")}`);
}

main(process.argv.slice(2))
  .then(() => {
    console.info("main finished");
  })
  .catch((err) => {
    error("Error running setup:main()", err);
  });
