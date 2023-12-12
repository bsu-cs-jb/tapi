import {
  Client,
  ClientCredentialsModel,
  Falsey,
  Token,
  User,
} from "oauth2-server";
import {
  FileModelToken,
  FileModelUser,
  fetchClient,
  fetchToken,
  writeToken,
  deleteToken,
  isInvalid,
} from "../AuthDb.js";
import { log } from "../logging.js";
import { hash } from "../hash.js";

function toScopeArray(scope: string | string[] | undefined): string[] {
  if (scope === undefined) {
    return [];
  } else {
    if (Array.isArray(scope)) {
      return scope as string[];
    } else {
      return scope.split(" ");
    }
  }
}

const DEFAULT_SCOPES = ["read", "write"];

export function FileModel(): ClientCredentialsModel {
  // load auth from resource db

  const model: ClientCredentialsModel = {
    // ********** BaseModel  **********

    /**
     * Invoked to retrieve a client using a client id or a client id/client
     * secret combination, depending on the grant type.
     */
    getClient: async (
      clientId: string,
      clientSecret: string,
      //callback?: Callback<Client | Falsey>,
    ): Promise<Client | Falsey> => {
      // log(`getClient(${clientId}, ${hash(clientSecret)})`);
      const authDef = await fetchClient(clientId);
      if (authDef !== undefined && hash(clientSecret) === authDef.secret) {
        return authDef.client;
      }
      return undefined;
    },

    /**
     * Invoked to save an access token and optionally a refresh token, depending
     * on the grant type.
     */
    saveToken: async (
      token: FileModelToken,
      client: Client,
      user: User,
      // callback?: Callback<Token>
    ): Promise<FileModelToken | Falsey> => {
      log(`saveToken(${token}, ${client.id}, ${user.userId})`, token);
      token.clientId = client.id;
      const dbToken = {
        id: token.accessToken,
        name: `Token for ${client.id}`,
        token: token,
      };
      token.client = client;
      token.user = user;
      writeToken(dbToken);
      return token;
    },

    // ********** RequestAuthenticationModel  **********

    /**
     * Invoked to retrieve an existing access token previously saved through
     * Model#saveToken().
     */
    getAccessToken: async (
      accessToken: string,
      // callback?: Callback<Token>,
    ): Promise<Token | Falsey> => {
      log(`getAccessToken(${accessToken})`);
      const dbToken = await fetchToken(accessToken);
      if (dbToken) {
        // log(`Found token:`, dbToken);
        if (await isInvalid(dbToken)) {
          deleteToken(dbToken.id);
        }
        return dbToken.token;
      }
    },

    /**
     * Invoked during request authentication to check if the provided access token
     * was authorized the requested scopes.
     */
    verifyScope: async (
      token: FileModelToken,
      scope: string | string[],
      // callback?: Callback<boolean>,
    ): Promise<boolean> => {
      // log(`verifyScope(${token}, ${scope}) token:`, token);
      const tokenScopes = toScopeArray(token.scope);
      if (tokenScopes.includes("admin")) {
        return true;
      }
      const requestedScopes = toScopeArray(scope);
      return requestedScopes.every((s) => tokenScopes.includes(s));
    },

    // ********** RefreshTokenModel  **********

    getUserFromClient: async (
      client: Client,
      // callback?: Callback<User | Falsey>,
    ): Promise<FileModelUser | Falsey> => {
      // log(`getUserFromClient(${client.id})`);
      const authDef = await fetchClient(client.id);
      if (authDef) {
        return authDef.user;
      }
      return undefined;
    },

    // Optional
    validateScope: async (
      user: FileModelUser,
      client: Client,
      scope: string | string[],
      // callback?: Callback<string | Falsey>,
    ): Promise<string | string[] | Falsey> => {
      // log(`validateScope(${user.username}, ${client.id}, ${scope})`);
      let requestedScopes = toScopeArray(scope);
      if (requestedScopes.length === 0) {
        requestedScopes = DEFAULT_SCOPES;
      }
      if (user.scopes.includes("admin")) {
        // let admins request any scope
        return requestedScopes;
      } else {
        return requestedScopes.filter((s) => user.scopes?.includes(s));
      }
    },
  };
  return model;
}
