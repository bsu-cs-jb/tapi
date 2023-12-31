import { readResource, refWithId, ResourceDef } from "./FileDb.js";
import { SessionDb, UserDb, makeUserDb } from "./IndecisiveTypes.js";

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
  if (id === undefined) {
    return undefined;
  }
  return readResource<UserDb>(refWithId(USER, id));
}

export async function fetchSession(id: string): Promise<SessionDb | undefined> {
  if (id === undefined) {
    return undefined;
  }
  return readResource<SessionDb>(refWithId(SESSION, id));
}
