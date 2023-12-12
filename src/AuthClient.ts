import { AuthDb } from "./AuthDb.js";
import { sendData } from "./ApiClient.js";
import { log } from "./logging.js";

const AUTH_ROOT = "/auth";

export async function createClient(
  auth: AuthDb,
  token?: string,
): Promise<AuthDb> {
  log("createClient()");
  const result = await sendData<AuthDb>(
    "POST",
    `${AUTH_ROOT}/clients`,
    auth,
    token,
  );
  return result;
}

export async function updateClient(
  auth: AuthDb,
  token?: string,
): Promise<AuthDb> {
  log("updateClient()");
  const result = await sendData<AuthDb>(
    "PATCH",
    `${AUTH_ROOT}/clients/${auth.id}`,
    auth,
    token,
  );
  return result;
}
