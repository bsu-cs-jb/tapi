import { throttle } from "lodash-es";
import { Client, User, Token } from "oauth2-server";
import {
  deleteResourceDb,
  getAll,
  readResource,
  refWithId,
  ResourceDef,
  writeResource,
} from "./FileDb.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";
import { config } from "./config.js";

export interface FileModelToken extends Token {
  clientId?: string;
}

export interface FileModelUser extends User {
  userId?: string;
  currentSessionId?: string;
}

export interface AuthDb {
  // client id
  id: string;
  name: string;
  secret: string;
  client: Client;
  user: FileModelUser;
}

export interface TokenDb {
  // token
  id: string;
  name: string;
  token: FileModelToken;
}

export const CLIENT: ResourceDef<AuthDb> = {
  database: "auth",
  name: "clients",
  singular: "client",
  paramName: "clientId",
  sortBy: "name",
};

export const TOKEN: ResourceDef<TokenDb> = {
  database: "auth",
  name: "tokens",
  singular: "token",
  paramName: "tokenId",
  sortBy: "name",
};

export async function fetchClient(id: string): Promise<AuthDb | undefined> {
  // log(`fetchClient(${id})`);
  return readResource<AuthDb>(refWithId(CLIENT, id));
}

export async function writeClient(auth: AuthDb): Promise<string | undefined> {
  return writeResource<AuthDb>(refWithId(CLIENT, auth.id), auth);
}

export async function fetchTokens(): Promise<TokenDb[]> {
  const tokens = await getAll<TokenDb>(TOKEN);
  if (tokens) {
    return tokens;
  }
  return [];
}

export async function isInvalid(dbToken: TokenDb): Promise<boolean> {
  let invalid = false;
  if (dbToken.token.accessTokenExpiresAt instanceof Date) {
    if (dbToken.token.accessTokenExpiresAt < new Date()) {
      invalid = true;
    }
  } else {
    invalid = true;
  }
  return invalid;
}

export async function immediatePurgeTokens(): Promise<TokenDb[]> {
  const tokens = await fetchTokens();
  const deletedTokens: TokenDb[] = [];

  for (const token of tokens) {
    if (await isInvalid(token)) {
      deletedTokens.push(token);
      await deleteToken(token.id);
    }
  }
  log(`Purged ${deletedTokens.length} expired tokens.`);

  return deletedTokens;
}

// purge tokens max of once every 120 seconds
export const purgeTokens = throttle(
  immediatePurgeTokens,
  config.PURGE_TOKEN_THROTTLE_MS,
  {
    leading: true,
    trailing: true,
  },
);

export async function fetchToken(id: string): Promise<TokenDb | undefined> {
  // log(`fetchToken(${id})`);
  return readResource<TokenDb>(refWithId(TOKEN, id));
}

export async function writeToken(token: TokenDb): Promise<string | undefined> {
  return writeResource<TokenDb>(refWithId(TOKEN, token.id), token);
}

export async function deleteToken(id: string): Promise<string | undefined> {
  return await deleteResourceDb<TokenDb>(refWithId(TOKEN, id));
}
