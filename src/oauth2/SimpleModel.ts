import {
  ClientCredentialsModel,
  Client,
  User,
  Token,
  Falsey,
} from "oauth2-server";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "../utils.js";
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

interface ClientDb {
  [key: string]: {
    secret: string;
    client: Client;
    user: User;
  };
}

interface TokenDb {
  [key: string]: Token;
}

const ALLOWED_SCOPES = ["read", "write"];

const TEST_CLIENTS: ClientDb = {
  admin: {
    secret: hash("admin"),
    client: {
      id: "admin",
      grants: ["client_credentials"],
    },
    user: {
      username: "Admin",
      userId: "admin",
      currentSessionId: "sessionId",
      scopes: ["read", "write", "admin"],
    },
  },
  tamatoa: {
    secret: hash("tamatoa"),
    client: {
      id: "tamatoa",
      grants: ["client_credentials"],
    },
    user: {
      username: "Jemaine",
      userId: "tamatoa",
      currentSessionId: "FhmzKh_kDQ",
      scopes: ["read", "write"],
    },
  },
};

const tokens: TokenDb = {};

export function SimpleModel(clientsParam?: ClientDb): ClientCredentialsModel {
  const clients = clientsParam || TEST_CLIENTS;
  const model: ClientCredentialsModel = {
    // ********** BaseModel  **********

    /**
     * Optional
     * Invoked to generate a new access token.
     */
    // generateAccessToken: async(
    //   client: Client,
    //   user: User,
    //   scope: string | string[],
    //   callback?: Callback<string>,
    // ): Promise<string> => {
    //   return "";
    // },

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
      if (
        clientId in clients &&
        hash(clientSecret) === clients[clientId].secret
      ) {
        return clients[clientId].client;
      }
      return undefined;
    },

    /**
     * Invoked to save an access token and optionally a refresh token, depending
     * on the grant type.
     */
    saveToken: async (
      token: Token,
      client: Client,
      user: User,
      // callback?: Callback<Token>
    ): Promise<Token | Falsey> => {
      // log(`saveToken(${token}, ${client.id}, ${user.username})`, token);
      tokens[token.accessToken] = token;
      token.client = client;
      token.user = user;
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
      // log(`getAccessToken(${accessToken})`);
      return tokens[accessToken];
    },

    /**
     * Invoked during request authentication to check if the provided access token
     * was authorized the requested scopes.
     */
    verifyScope: async (
      token: Token,
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
    ): Promise<User | Falsey> => {
      // log(`getUserFromClient(${client.id})`);
      if (client.id in clients) {
        // const user = clients[client.id].user;
        // log(`returning user ${user.username} for client.`);
        return clients[client.id].user;
      }
      return undefined;
    },

    // Optional
    validateScope: async (
      user: User,
      client: Client,
      scope: string | string[],
      // callback?: Callback<string | Falsey>,
    ): Promise<string | string[] | Falsey> => {
      // log(`validateScope(${user.username}, ${client.id}, ${scope})`);
      const requestedScopes = toScopeArray(scope);
      if (requestedScopes.length === 0) {
        return ALLOWED_SCOPES.filter((s) => user.scopes.includes(s));
      } else {
        return requestedScopes.filter((s) => user.scopes.includes(s));
      }
    },
  };
  return model;
}
