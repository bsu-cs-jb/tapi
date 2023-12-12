import { toJson, base64 } from "./utils.js";
import { log } from "./logging.js";

const SERVER = "http://localhost:3000";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
}

export async function sendData<T>(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: string | object,
  token?: string,
): Promise<T> {
  const headersObj: Record<string, string> = {};
  if (typeof body !== "string") {
    body = toJson(body);
    headersObj["Content-Type"] = "application/json";
  }
  if (token) {
    headersObj["Authorization"] = `Bearer ${token}`;
  }
  const headers = new Headers(headersObj);
  const url = `${SERVER}${path}`;
  log(`sendData(${method}, ${url}) body: ${body}`);
  const result = await fetch(url, {
    method,
    body,
    headers,
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        return response.text().then((error_body) => {
          const message = `HTTP Error ${response.status}: ${error_body}`;
          throw new Error(message);
        });
      }
    })
    .then((json) => {
      return json as T;
    });
  return result;
}

export async function fetchToken(
  id: string,
  secret: string,
  server?: string,
): Promise<string> {
  if (!server) {
    server = SERVER;
  }
  const result = await fetch(`${server}/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: new Headers({
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${base64(`${id}:${secret}`)}`,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      return (json as TokenResponse).access_token;
    });
  return result;
}
