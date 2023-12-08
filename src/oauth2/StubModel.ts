import { ClientCredentialsModel, Client, User, Token, Callback, Falsey } from "oauth2-server";
import { log } from "../utils.js";

const model:ClientCredentialsModel = {
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
    return undefined;
  },

  // ********** RequestAuthenticationModel  **********

  /**
  * Invoked to retrieve an existing access token previously saved through
  * Model#saveToken().
  */
  getAccessToken: async (
    accessToken: string, 
    callback?: Callback<Token>
  ): Promise<Token | Falsey> => {
    return undefined;
  },

  /**
  * Invoked during request authentication to check if the provided access token
  * was authorized the requested scopes.
  */
  verifyScope: async (token: Token, scope: string | string[], callback?: Callback<boolean>): Promise<boolean> => {
    return true;
  },

  // ********** RefreshTokenModel  **********

  getUserFromClient: async (client: Client, callback?: Callback<User | Falsey>): Promise<User | Falsey> => {
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
