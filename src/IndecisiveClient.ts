import { sendData } from "./ApiClient.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";
import { UserDb } from "./IndecisiveTypes.js";

const PATH_ROOT = "/indecisive";

export async function invite(
  sessionId: string,
  userId: string,
  token?: string,
): Promise<UserDb> {
  // log("invite(${sessionId}, ${userId})");
  const body = {
    userId,
  };
  const result = await sendData<UserDb>(
    "POST",
    `${PATH_ROOT}/sessions/${sessionId}/invite`,
    body,
    token,
  );
  return result;
}

export async function createUser(
  user: UserDb,
  token?: string,
): Promise<UserDb> {
  // log("createUser()");
  const result = await sendData<UserDb>(
    "POST",
    `${PATH_ROOT}/users`,
    user,
    token,
  );
  return result;
}

export async function updateUser(
  user: UserDb,
  token?: string,
): Promise<UserDb> {
  // log("updateUser()");
  const result = await sendData<UserDb>(
    "PATCH",
    `${PATH_ROOT}/users/${user.id}`,
    user,
    token,
  );
  return result;
}
