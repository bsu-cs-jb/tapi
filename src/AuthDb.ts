import { Client, User, Token } from "oauth2-server";
import {
  readResource,
  refWithId,
  ResourceDef,
  writeResource,
} from "./FileDb.js";
import { log } from "./utils.js";
import { hash } from "./hash.js";

export interface FileModelToken extends Token {
  clientId?: string;
}

export interface FileModelUser extends User {
  userId?: string;
  currentSessionId?: string;
  // scopes?: string[];
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
  log(`fetchClient(${id})`);
  return readResource<AuthDb>(refWithId(CLIENT, id));
}

export async function writeClient(auth: AuthDb): Promise<string | undefined> {
  return writeResource<AuthDb>(refWithId(CLIENT, auth.id), auth);
}

export async function fetchToken(id: string): Promise<TokenDb | undefined> {
  log(`fetchToken(${id})`);
  return readResource<TokenDb>(refWithId(TOKEN, id));
}

export async function writeToken(token: TokenDb): Promise<string | undefined> {
  return writeResource<TokenDb>(refWithId(TOKEN, token.id), token);
}
