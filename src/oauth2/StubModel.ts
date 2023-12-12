import {
  ClientCredentialsModel,
  Client,
  User,
  Token,
  // Callback,
  Falsey,
} from "oauth2-server";
import { log } from "../logging.js";

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
    return undefined;
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
    log(`verifyScope(${token}, ${scope}) token:`, token);
    return false;
  },

  // ********** RefreshTokenModel  **********

  getUserFromClient: async (
    client: Client,
    // callback?: Callback<User | Falsey>,
  ): Promise<User | Falsey> => {
    log(`getUserFromClient(${client.id})`);
    return undefined;
  },

  // Optional
  validateScope: async (
    user: User,
    client: Client,
    scope: string | string[],
    // callback?: Callback<string | Falsey>,
  ): Promise<string | string[] | Falsey> => {
    log(`validateScope(${user.username}, ${client.id}, ${scope})`);
    return false;
  },
};

export default model;
