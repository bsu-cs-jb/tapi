import { clone } from "lodash-es";

import { fromJson, toJson, base64 } from "./utils.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log } from "./logging.js";

class FetchError extends Error {
  description: string;
  cause?: Error;
  status?: number;
  body?: string;
  json?: Record<string, string>;
  bodyReason?: string;
  bodyMessage?: string;
  bodyStatus?: string;

  constructor(description: string, cause?: Error) {
    let message = `HTTP Error for ${description}.`;
    if (cause) {
      message = `HTTP Error for ${description} caused by ${cause.message}.`;
    }
    super(message);
    this.description = description;
    this.cause = cause;
  }

  update(response: Response): Promise<FetchError> {
    this.status = response.status;
    this.message = `HTTP Error ${response.status} for ${this.description}`;
    return response.text().then((txt) => {
      this.body = txt;
      try {
        // attempt to parse as JSON
        this.json = fromJson(txt);
        this.bodyStatus = this.json?.status;
        this.bodyMessage = this.json?.message;
        this.bodyReason = this.json?.reason;
        this.message = `HTTP Error ${response.status} for ${this.description}: ${this.body}`;
      } catch (error) {
        // ignore
      }
      return this;
    });
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
}

export async function doFetch<T>(
  method: "POST" | "PATCH" | "PUT" | "GET" | "DELETE",
  url: string,
  options?: {
    body?: string | object;
    bearerToken?: string;
    headers?: Record<string, string>;
  },
): Promise<T> {
  let headersObj: Record<string, string> = {};
  if (options && "headers" in options && options.headers) {
    headersObj = clone(options.headers);
  }
  let body: string | undefined;
  if (options && "body" in options) {
    if (typeof options.body === "string") {
      body = options.body;
    } else {
      body = toJson(options.body);
      headersObj["Content-Type"] = "application/json";
    }
  }

  if (options && "bearerToken" in options) {
    headersObj["Authorization"] = `Bearer ${options.bearerToken}`;
  }
  const headers = new Headers(headersObj);

  const result = await fetch(url, {
    method,
    body,
    headers,
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        const err = new FetchError(`doFetch(${method}, ${url}): ${body}`);
        return err.update(response).then((error) => {
          throw error;
        });
      }
    })
    .then((json) => {
      return json as T;
    })
    .catch((error) => {
      if (error instanceof FetchError) {
        throw error;
      } else {
        throw new FetchError(`doFetch(${method}, ${url}): ${body}`, error);
      }
    });
  return result;
}

export async function fDelete<T>(
  path: string,
  server: string,
  bearerToken?: string,
): Promise<T> {
  return doFetch<T>("DELETE", `${server}${path}`, {
    bearerToken,
  });
}

export async function fGet<T>(
  path: string,
  server: string,
  bearerToken?: string,
): Promise<T> {
  return doFetch<T>("GET", `${server}${path}`, {
    bearerToken,
  });
}

export async function sendData<T>(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: string | object,
  server: string,
  bearerToken?: string,
): Promise<T> {
  return doFetch<T>(method, `${server}${path}`, {
    body,
    bearerToken,
  });
}

export async function fetchFullToken(
  id: string,
  secret: string,
  server: string,
  scope?: string | string[],
): Promise<TokenResponse> {
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
      if (response.ok) {
        return response.json();
      } else {
        const err = new FetchError(`fetchToken$(${id})`);
        return err.update(response).then((error) => {
          throw error;
        });
      }
    })
    .then((json) => {
      return (json as TokenResponse)
    })
    .catch((error) => {
      if (error instanceof FetchError) {
        throw error;
      } else {
        throw new FetchError(`fetchToken(${id}):`, error);
      }
    });
  return result;
}

export async function fetchToken(
  id: string,
  secret: string,
  server: string,
  scope?: string | string[],
): Promise<string> {
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
      if (response.ok) {
        return response.json();
      } else {
        const err = new FetchError(`fetchToken$(${id})`);
        return err.update(response).then((error) => {
          throw error;
        });
      }
    })
    .then((json) => {
      return (json as TokenResponse).access_token;
    })
    .catch((error) => {
      if (error instanceof FetchError) {
        throw error;
      } else {
        throw new FetchError(`fetchToken(${id}):`, error);
      }
    });
  return result;
}
