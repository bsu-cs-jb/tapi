import {
  ClientCredentialsModel,
  Client,
  User,
  Token,
  // Callback,
  Falsey,
} from "oauth2-server";
import { log } from "../utils.js";

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

const clients: ClientDb = {
  hello: {
    secret: "there",
    client: {
      id: "hello",
      grants: ["client_credentials"],
    },
    user: {
      username: "billy",
    },
  },
};

const tokens: TokenDb = {};

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
    log(`getClient(${clientId}, ${clientSecret})`);
    if (clientId in clients && clientSecret === clients[clientId].secret) {
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
    log(`saveToken(${token}, ${client.id}, ${user.username})`, token);
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
    log(`getAccessToken(${accessToken})`);
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
    log(`verifyScope(${token}, ${scope})`);
    return true;
  },

  // ********** RefreshTokenModel  **********

  getUserFromClient: async (
    client: Client,
    // callback?: Callback<User | Falsey>,
  ): Promise<User | Falsey> => {
    log(`getUserFromClient(${client.id})`);
    if (client.id in clients) {
      const user = clients[client.id].user;
      log(`returning user ${user.username} for client.'`);
      return clients[client.id].user;
    }
    return undefined;
  },

  // Optional
  // validateScope: async (
  //   user: User,
  //   client: Client,
  //   scope: string | string[],
  //   callback?: Callback<string | Falsey>,
  // ): Promise<string | string[] | Falsey> => {
  //   return undefined;
  // },
};

export default model;
