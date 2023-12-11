import { readResource, refWithId, ResourceDef, IdResource } from "./FileDb.js";
import { IdName } from "./RestAPI.js";
import { SessionDb, UserDb, makeUserDb } from "./IndecisiveTypes.js";

import {
  Session,
  Attending,
  Vote,
  Invitation,
  Suggestion,
} from "./indecisive_rn_types.js";
import { assert, AllOptional, removeId } from "./utils.js";
import { urlid } from "./genid.js";

export const USER: ResourceDef<UserDb> = {
  database: "indecisive",
  name: "users",
  singular: "user",
  paramName: "userId",
  sortBy: "name",
  builder: makeUserDb,
};

export const SESSION: ResourceDef<SessionDb> = {
  database: "indecisive",
  name: "sessions",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
};

export async function fetchUser(id: string): Promise<UserDb | undefined> {
  return readResource<UserDb>(refWithId(USER, id));
}

export async function fetchSession(id: string): Promise<SessionDb | undefined> {
  return readResource<SessionDb>(refWithId(SESSION, id));
}
