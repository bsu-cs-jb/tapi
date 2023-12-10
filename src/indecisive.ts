import { Context } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import { authenticate, token } from "./oauth2/koa.js";
import {
  readResource,
  refWithId,
  ResourceDef,
  writeResource,
} from "./FileDb.js";
import {
  getCollection,
  getResource,
  postResource,
  putResource,
  routerParam,
} from "./RestAPI.js";

import {
  User,
  Session,
  Attending,
  Invitation,
  Suggestion,
} from "./indecisive_types.js";
import { log } from "./utils.js";

export interface UserInvitationDb {
  sessionId: string;
  accepted: boolean;
  attending: Attending;
}

export interface InvitationDb {
  userId: string;
  accepted: boolean;
  attending: Attending;
}

export interface SessionDb {
  id: string;
  ownerId: string;
  name: string;
  invitations: InvitationDb[];
  suggestions: Suggestion[];
}

interface UserDb {
  id: string;
  name: string;
  owns: SessionDb[];
  invitations: UserInvitationDb[];
}

const USER: ResourceDef = {
  database: "indecisive",
  name: "users",
  singular: "user",
  paramName: "userId",
  sortBy: "name",
};

const INVITATIONS: ResourceDef = {
  database: "indecisive",
  name: "invitations",
  singular: "invitation",
  paramName: "invitationSessionId",
  sortBy: "name",
  parents: [USER],
};

const OWN_SESSION: ResourceDef = {
  database: "indecisive",
  name: "owns",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
  parents: [USER],
};

const SESSION: ResourceDef = {
  database: "indecisive",
  name: "sessions",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
};

async function fetchUser(id: string): Promise<UserDb | undefined> {
  return readResource<UserDb>(refWithId(USER, id));
}

async function fetchSession(id: string): Promise<SessionDb | undefined> {
  return readResource<SessionDb>(refWithId(SESSION, id));
}

function fetchCurrentSession(errorIfMissing: boolean = true) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const { auth: { user: { currentSessionId } } } = ctx.state;
    if (currentSessionId) {
      ctx.state.currentSession = await fetchSession(currentSessionId);
    } else {
      console.error(`No current session associated with clientId.`);
    }
    if (errorIfMissing && !ctx.state.currentSession) {
      ctx.status = 400;
      console.error(`No current session associated with clientId.`);
      return;
    }
    await next();
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function indecisiveAuth(authEnabled: boolean, requireSelf: boolean, skipAuthValue?: any) {
  return async (ctx: Context, next: () => Promise<void>) => {
    if (!authEnabled) {
      ctx.state.auth = skipAuthValue;
    }
    const userId = ctx?.state?.auth?.user?.userId;
    if (userId) {
      // log(`Fetching self for userId: ${userId}`);
      ctx.state.self = await fetchUser(userId);
    } else {
      log("No userId find in ctx.state.auth");
    }

    // if self is required, then error on missing self
    if (requireSelf && !ctx.state.self) {
      ctx.status = 400;
      console.error(`No user associated with clientId '${userId}' not found.`);
      return;
    }
    await next();
  };
}

const SKIP_AUTH = {
  user: {
    username: "no-auth",
    userId: "tamatoa",
    currentSessionId: "sessionId",
  },
  scope: ["read","write","admin"],
};

export function indecisiveRoutes(router: Router) {
  // INDECISIVE AUTH
  const authEnabled = false;
  if (authEnabled) {
    router.use(authenticate("read"));
  }
  router.use(indecisiveAuth(authEnabled, true, SKIP_AUTH));

  router.use(["/current-session"], fetchCurrentSession());

  router.get("/", async (ctx) => {
    let body = "";
    body +=
      "<!DOCTYPE html>\n<html><head><title>Indecisive Root</title></head><body>";
    body += "<div><p>Indecisive</p><ul>\n";
    [USER, SESSION].forEach((resource) => {
      body += `<li>${_.capitalize(resource.name)}: <a href="${router.url(
        resource.name + "-html",
      )}">html</a> <a href="${router.url(resource.name)}">json</a></li>\n`;
    });
    body += "</ul></div>\n";
    body += "<div><p>Other links</p><ul>\n";
    body += '<li><a href="http://google.com">Google</a></li>\n';
    body += "</ul></div>\n";
    ctx.body = body;
  });

  routerParam(router, USER);
  routerParam(router, SESSION);

  getCollection(router, USER);
  getResource(router, USER, [OWN_SESSION, INVITATIONS]);
  postResource(router, USER);
  putResource(router, USER);

  getCollection(router, OWN_SESSION);
  // getResource(router, OWN_SESSION);
  // postResource(router, OWN_SESSION);

  getCollection(router, SESSION);
  getResource(router, SESSION);
  // Post to session means: create a new session owned by me
  postResource(router, SESSION);
  // Put to session updates session (if owned by me)
  putResource(router, SESSION);

  // router.post("session-invite", "/sessions/:sessionId/invite", async (ctx) => {
  // router.post("session-respond", "/sessions/:sessionId/respond", async (ctx) => {
  // router.post("session-suggest", "/sessions/:sessionId/suggest", async (ctx) => {
  // router.put("session-vote", "/sessions/:sessionId/vote/:suggestionId", async (ctx) => {

  router.get("test-html", "/test", async (ctx) => {
    const { state: { auth, self } } = ctx;
    let body = '';
    body += `<p>Auth userId: ${auth?.user?.userId}</p>`;
    body += `<p>Scopes: ${auth?.scope?.join(" ")}</p>`;
    body += `<p>Self id: ${self?.id}</p>`;
    body += `<p>Self name: ${self?.name}</p>`;
    // body += `<p>Client id: ${auth.client.id}</p>`;
    // body += `<p>Client grants: ${auth.client.grants}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: self.id,
    })}">${self.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });

  router.get("self", "/self", async (ctx) => {
    const { state: { self, auth } } = ctx;
    console.log('/self auth', auth);
    ctx.body = self;
  });

  router.get("current-session", "/current-session", async (ctx) => {
    const { state: { currentSession } } = ctx;
    ctx.body = currentSession;
  });

  // Create a new session owned by this user
  router.post("user-sessions", "/users/:userId/owns", async (ctx) => {
    const { user } = ctx;
    let body = `<p>User id: ${user.id}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: user.id,
    })}">${user.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });

  router.get("user-sessions-html", "/users/:userId/sessions", async (ctx) => {
    const { user } = ctx;
    let body = `<p>User id: ${user.id}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: user.id,
    })}">${user.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });
}
