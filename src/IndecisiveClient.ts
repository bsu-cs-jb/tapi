import { merge } from "lodash-es";

import { AuthDb } from "./AuthDb.js";
import {
  TokenResponse,
  fetchToken,
  fetchFullToken,
  doFetch,
} from "./ApiClient.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./utils/logging.js";
import { UserDb } from "./IndecisiveTypes.js";
import { Session, Vote, Attending } from "./indecisive_rn_types.js";
import { config } from "./config.js";
import { AllOptional } from "./utils.js";

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
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    let bearerToken = this.token;
    let headers = this.headers;
    if (options?.bearerToken) {
      bearerToken = options?.bearerToken;
    }
    if (options?.headers) {
      headers = merge(headers, options?.headers);
    }
    return doFetch<T>(method, `${this.server}${path}`, {
      body,
      bearerToken,
      headers,
    });
  }

  async invite(
    sessionId: string,
    userId: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const body = {
      userId,
    };
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/invite`,
      body,
      options,
    );
    return result;
  }

  async respond(
    sessionId: string,
    accepted: boolean,
    attending: Attending,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const body = {
      accepted,
      attending,
    };
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/respond`,
      body,
      options,
    );
    return result;
  }

  async createUser(
    user: UserDb,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<UserDb> {
    const result = await this.doFetch<UserDb>(
      "POST",
      `${PATH_ROOT}/users`,
      user,
      options,
    );
    return result;
  }

  async updateUser(
    user: UserDb,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<UserDb> {
    const result = await this.doFetch<UserDb>(
      "PATCH",
      `${PATH_ROOT}/users/${user.id}`,
      user,
      options,
    );
    return result;
  }

  async session(
    id: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const result = await this.doFetch<Session>(
      "GET",
      `${PATH_ROOT}/sessions/${id}`,
      options,
    );
    return result;
  }

  async currentSession(options?: {
    bearerToken?: string;
    headers?: Record<string, string>;
  }): Promise<Session> {
    const result = await this.doFetch<Session>(
      "GET",
      `${PATH_ROOT}/current-session`,
      options,
    );
    return result;
  }

  async self(options?: {
    bearerToken?: string;
    headers?: Record<string, string>;
  }): Promise<object> {
    const result = await this.doFetch<Session>(
      "GET",
      `${PATH_ROOT}/self`,
      undefined,
      options,
    );
    return result;
  }

  async deleteClient(
    id: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<object> {
    const result = await this.doFetch<Session>(
      "DELETE",
      `${AUTH_ROOT}/clients/${id}`,
      undefined,
      options,
    );
    return result;
  }

  async deleteToken(
    token: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<object> {
    const result = await this.doFetch<Session>(
      "DELETE",
      `${AUTH_ROOT}/tokens/${token}`,
      undefined,
      options,
    );
    return result;
  }

  async deleteUser(
    id: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<object> {
    const result = await this.doFetch<Session>(
      "DELETE",
      `${PATH_ROOT}/users/${id}`,
      undefined,
      options,
    );
    return result;
  }

  async deleteSession(
    sessionId: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<object> {
    const result = await this.doFetch<object>(
      "DELETE",
      `${PATH_ROOT}/sessions/${sessionId}`,
      undefined,
      options,
    );
    return result;
  }

  async suggest(
    sessionId: string,
    name: string,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/suggest`,
      { name },
      options,
    );
    return result;
  }

  async vote(
    sessionId: string,
    suggestionId: string,
    vote: Vote,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/vote/${suggestionId}`,
      { vote },
      options,
    );
    return result;
  }

  async createSession(
    session: AllOptional<Session>,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<Session> {
    const result = await this.doFetch<Session>(
      "POST",
      `${PATH_ROOT}/sessions/`,
      session,
      options,
    );
    return result;
  }

  async createClient(
    auth: AuthDb,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<AuthDb> {
    const result = await this.doFetch<AuthDb>(
      "POST",
      `${AUTH_ROOT}/clients`,
      auth,
      options,
    );
    return result;
  }

  async updateClient(
    auth: AuthDb,
    options?: {
      bearerToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<AuthDb> {
    const result = await this.doFetch<AuthDb>(
      "PATCH",
      `${AUTH_ROOT}/clients/${auth.id}`,
      auth,
      options,
    );
    return result;
  }
}
