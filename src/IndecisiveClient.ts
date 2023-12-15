import { merge } from "lodash-es";

import { AuthDb } from "./AuthDb.js";
import {
  TokenResponse,
  fetchToken,
  fetchFullToken,
  fGet,
  doFetch,
  fDelete,
} from "./ApiClient.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";
import { UserDb } from "./IndecisiveTypes.js";
import { Session, Vote, Attending } from "./indecisive_rn_types.js";
import { config } from "./config.js";

const PATH_ROOT = "/indecisive";
const AUTH_ROOT = "/auth";

export async function makeIndecisiveClient(
  server: string,
  clientId?: string,
  clientSecret?: string,
  scope?: string | string[],
  options: {
    bypassRateLimit: boolean;
  } = { bypassRateLimit: true },
): Promise<IndecisiveClient> {
  const client = (() => {
    if (options.bypassRateLimit) {
      return new IndecisiveClient(server, undefined, {
        "X-RateLimit-Bypass": config.RATELIMIT_SECRET,
      });
    } else {
      return new IndecisiveClient(server);
    }
  })();
  if (clientId && clientSecret) {
    await client.fetchToken(clientId, clientSecret, scope);
  }
  return client;
}

export class IndecisiveClient {
  readonly server: string;
  token: string = "MISSING";
  headers: Record<string, string> = {};

  constructor(
    server: string,
    token?: string,
    headers?: Record<string, string>,
  ) {
    this.server = server;
    if (token) {
      this.token = token;
    }
    if (headers) {
      this.headers = merge(this.headers, headers);
    }
  }

  async fetchFullToken(
    id: string,
    secret: string,
    scope?: string | string[],
  ): Promise<TokenResponse> {
    const token = await fetchFullToken(id, secret, this.server, scope);
    this.token = token.access_token;
    return token;
  }

  async fetchToken(
    id: string,
    secret: string,
    scope?: string | string[],
  ): Promise<string> {
    const token = await fetchToken(id, secret, this.server, scope);
    this.token = token;
    return token;
  }

  async doFetch<T>(
    method: "POST" | "PATCH" | "PUT" | "GET" | "DELETE",
    path: string,
    body?: string | object,
  ): Promise<T> {
    return doFetch<T>(method, `${this.server}${path}`, {
      body,
      bearerToken: this.token,
      headers: this.headers,
    });
  }

  async invite(sessionId: string, userId: string): Promise<Session> {
    const body = {
      userId,
    };
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/invite`,
      body,
    );
    return result;
  }

  async respond(
    sessionId: string,
    accepted: boolean,
    attending: Attending,
  ): Promise<Session> {
    const body = {
      accepted,
      attending,
    };
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/respond`,
      body,
    );
    return result;
  }

  async createUser(user: UserDb): Promise<UserDb> {
    const result = await this.doFetch<UserDb>(
      "POST",
      `${PATH_ROOT}/users`,
      user,
    );
    return result;
  }

  async updateUser(user: UserDb): Promise<UserDb> {
    const result = await this.doFetch<UserDb>(
      "PATCH",
      `${PATH_ROOT}/users/${user.id}`,
      user,
    );
    return result;
  }

  async session(id: string): Promise<Session> {
    const result = await fGet<Session>(
      `${PATH_ROOT}/sessions/${id}`,
      this.server,
      this.token,
    );
    return result;
  }

  async currentSession(): Promise<Session> {
    const result = await fGet<Session>(
      `${PATH_ROOT}/current-session`,
      this.server,
      this.token,
    );
    return result;
  }

  async self(): Promise<object> {
    const result = await fGet<Session>(
      `${PATH_ROOT}/self`,
      this.server,
      this.token,
    );
    return result;
  }

  async deleteClient(id: string): Promise<object> {
    const result = await fDelete<Session>(
      `${AUTH_ROOT}/clients/${id}`,
      this.server,
      this.token,
    );
    return result;
  }

  async deleteToken(token: string): Promise<object> {
    const result = await fDelete<Session>(
      `${AUTH_ROOT}/tokens/${token}`,
      this.server,
      this.token,
    );
    return result;
  }

  async deleteUser(id: string): Promise<object> {
    const result = await fDelete<Session>(
      `${PATH_ROOT}/users/${id}`,
      this.server,
      this.token,
    );
    return result;
  }

  async deleteSession(sessionId: string): Promise<object> {
    const result = await fDelete<Session>(
      `${PATH_ROOT}/sessions/${sessionId}`,
      this.server,
      this.token,
    );
    return result;
  }

  async addSuggestion(sessionId: string, name: string): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/suggest`,
      { name },
    );
    return result;
  }

  async vote(
    sessionId: string,
    suggestionId: string,
    vote: Vote,
  ): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/vote/${suggestionId}`,
      { vote },
    );
    return result;
  }

  async createSession(description: string): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/`,
      { description },
    );
    return result;
  }

  async createClient(auth: AuthDb): Promise<AuthDb> {
    const result = await this.doFetch<AuthDb>(
      "POST",
      `${AUTH_ROOT}/clients`,
      auth,
    );
    return result;
  }

  async updateClient(auth: AuthDb): Promise<AuthDb> {
    const result = await this.doFetch<AuthDb>(
      "PATCH",
      `${AUTH_ROOT}/clients/${auth.id}`,
      auth,
    );
    return result;
  }
}
