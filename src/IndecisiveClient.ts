import { AuthDb } from "./AuthDb.js";
import { fetchToken, fGet, sendData, fDelete } from "./ApiClient.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";
import { UserDb } from "./IndecisiveTypes.js";
import { Session, Vote } from "./indecisive_rn_types.js";

const PATH_ROOT = "/indecisive";
const AUTH_ROOT = "/auth";

export class IndecisiveClient {
  readonly server: string;
  token: string = "MISSING";

  constructor(server: string, token?: string) {
    this.server = server;
    if (token) {
      this.token = token;
    }
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

  async invite(sessionId: string, userId: string): Promise<Session> {
    const body = {
      userId,
    };
    const result = await sendData<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/invite`,
      body,
      this.server,
      this.token,
    );
    return result;
  }

  async createUser(user: UserDb): Promise<UserDb> {
    const result = await sendData<UserDb>(
      "POST",
      `${PATH_ROOT}/users`,
      user,
      this.server,
      this.token,
    );
    return result;
  }

  async updateUser(user: UserDb): Promise<UserDb> {
    const result = await sendData<UserDb>(
      "PATCH",
      `${PATH_ROOT}/users/${user.id}`,
      user,
      this.server,
      this.token,
    );
    return result;
  }

  async currentSession(): Promise<object> {
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
    const result = await sendData<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/suggest`,
      { name },
      this.server,
      this.token,
    );
    return result;
  }

  async vote(
    sessionId: string,
    suggestionId: string,
    vote: Vote,
  ): Promise<Session> {
    const result = await sendData<Session>(
      "POST",
      `${PATH_ROOT}/sessions/${sessionId}/vote/${suggestionId}`,
      { vote },
      this.server,
      this.token,
    );
    return result;
  }

  async createSession(description: string): Promise<Session> {
    const result = await sendData<Session>(
      "POST",
      `${PATH_ROOT}/sessions/`,
      { description },
      this.server,
      this.token,
    );
    return result;
  }

  async createClient(auth: AuthDb): Promise<AuthDb> {
    const result = await sendData<AuthDb>(
      "POST",
      `${AUTH_ROOT}/clients`,
      auth,
      this.server,
      this.token,
    );
    return result;
  }

  async updateClient(auth: AuthDb): Promise<AuthDb> {
    const result = await sendData<AuthDb>(
      "PATCH",
      `${AUTH_ROOT}/clients/${auth.id}`,
      auth,
      this.server,
      this.token,
    );
    return result;
  }
}
