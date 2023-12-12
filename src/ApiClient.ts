import { toJson, base64 } from "./utils.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";

const SERVER = "http://cs411.duckdns.org";
// const SERVER = "http://localhost:3000";

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
  server?: string,
): Promise<T> {
  if (!server) {
    server = SERVER;
  }
  const headersObj: Record<string, string> = {};
  if (typeof body !== "string") {
    body = toJson(body);
    headersObj["Content-Type"] = "application/json";
  }
  if (token) {
    headersObj["Authorization"] = `Bearer ${token}`;
  }
  const headers = new Headers(headersObj);
  const url = `${server}${path}`;
  // log(`sendData(${method}, ${url}) body: ${body}`);
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
  scope?: string | string[],
  server?: string,
): Promise<string> {
  if (!server) {
    server = SERVER;
  }
  const params: Record<string, string> = {
    grant_type: "client_credentials",
  };
  if (scope !== undefined) {
    if (Array.isArray(scope)) {
      params["scope"] = scope.join(" ");
    } else {
      params["scope"] = scope;
    }
  }
  const body = new URLSearchParams(params);
  const result = await fetch(`${server}/token`, {
    method: "POST",
    body,
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
