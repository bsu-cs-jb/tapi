import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import { AuthDb } from "./AuthDb.js";
import { createClient, updateClient } from "./AuthClient.js";
import { readFileAsJson } from "./FileDb.js";
import { config } from "./config.js";
import { log, logger } from "./logging.js";
// import { hash } from "./hash.js";

interface UserDef {
  id: string;
  name: string;
  realname: string;
  secret: string;
}

function authDbfromUser(user: UserDef, sessionId: string): AuthDb {
  return {
    id: user.id,
    name: user.name,
    secret: user.secret,
    client: {
      id: user.id,
      grants: ["client_credentials"],
    },
    user: {
      userId: user.id,
      currentSessionId: sessionId,
      scopes: ["read", "write"],
    },
  };
}

async function users() {
  // need session id
  const rawUsers = await readFileAsJson(".users.env");
  const userDef = rawUsers as unknown as UserDef[];
  // const token = await fetchToken();
  // console.log(userDef);
  for (const user of userDef) {
    log(`User: ${user.id} ${user.name} ${user.secret}`);
    const authDb = authDbfromUser(user, "cs411-final");
    log("Creating Auth:", authDb);
    // await writeClient(authDb);
    try {
      const client = await createClient(authDb);
      log("Client Created:", client);
    } catch (err) {
      const message = (err as Error).message;
      if (message.match(/already exists/)) {
        log("Client already exists, replacing instead.");
        const client = await updateClient(authDb);
        log("Client Created:", client);
      }
    }
    break;
  }
}

async function main() {
  console.log("Doing work");
  log(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  log(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  log(`DB_GRADING_DIR: ${config.DB_GRADING_DIR}`);
  log(`DB_INDECISIVE_DIR: ${config.DB_INDECISIVE_DIR}`);
  await users();
}

main()
  .then(() => {
    console.log("main finished");
  })
  .catch((err) => {
    logger.error("Error running setup:main()");
  });
