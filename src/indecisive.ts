import { Context, Next } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import { authenticate } from "./oauth2/koa.js";
import {
  readResource,
  refWithId,
  ResourceDef,
  writeResource,
  IdResource,
} from "./FileDb.js";
import {
  deleteResource,
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
  Vote,
  Invitation,
  Suggestion,
} from "./indecisive_types.js";
import { log, assert, AllOptional, toJson } from "./utils.js";
import { urlid } from "./genid.js";

export interface UserInvitationDb {
  sessionId: string;
  accepted: boolean;
  attending: Attending;
}

export interface SuggestionDb {
  userId: string;
  id: string;
  name: string;
  upVoteUserIds: string[];
  downVoteUserIds: string[];
}

export interface InvitationDb {
  userId: string;
  accepted: boolean;
  attending: Attending;
}

export interface SessionDb extends IdResource {
  id: string;
  ownerId: string;
  name: string;
  invitations: InvitationDb[];
  suggestions: SuggestionDb[];
}

interface UserDb extends IdResource {
  id: string;
  name: string;
  ownsSessions: string[];
  invitedSessions: string[];
}

function getInvitation(
  session: SessionDb,
  userId: string,
): InvitationDb | undefined {
  return session.invitations.find((i) => i.userId === userId);
}

function getSuggestion(
  session: SessionDb,
  id: string,
): SuggestionDb | undefined {
  return session.suggestions.find((s) => s.id === id);
}

function findSuggestionByName(
  session: SessionDb,
  name: string,
): SuggestionDb | undefined {
  return session.suggestions.find((s) => s.name === name);
}

function updateResponse(
  session: SessionDb,
  userId: string,
  accepted: boolean,
  attending: Attending,
): SessionDb {
  const existingInvite = getInvitation(session, userId);
  assert(
    existingInvite !== undefined,
    `User ${userId} not invited to session ${session.id}`,
  );
  if (existingInvite) {
    existingInvite.accepted = accepted;
    existingInvite.attending = attending;
  }
  return session;
}

function makeSuggestionDb(name: string, userId: string): SuggestionDb {
  return {
    id: urlid(),
    userId,
    name,
    upVoteUserIds: [],
    downVoteUserIds: [],
  };
}

function addSuggestion(
  session: SessionDb,
  userId: string,
  name: string,
): SessionDb {
  const existingInvite = getInvitation(session, userId);
  assert(
    existingInvite !== undefined,
    `User ${userId} not invited to session ${session.id}`,
  );
  const existingSuggestion = findSuggestionByName(session, name);
  if (existingSuggestion) {
    return session;
  }
  session.suggestions.push(makeSuggestionDb(name, userId));
  return session;
}

function updateSuggestion(
  session: SessionDb,
  suggestion: string | SuggestionDb,
  userId: string,
  vote: Vote,
): SessionDb {
  const existingInvite = getInvitation(session, userId);
  assert(
    existingInvite !== undefined,
    `User ${userId} not invited to session ${session.id}`,
  );
  let suggestObj: SuggestionDb | undefined;
  if (typeof suggestion === "string") {
    suggestObj = getSuggestion(session, suggestion);
  } else {
    suggestObj = suggestion;
  }
  assert(suggestObj !== undefined, "Suggestion not found in session");
  if (!suggestObj) {
    return session;
  }
  // Clear up/down votes first
  suggestObj.upVoteUserIds = removeId(userId, suggestObj.upVoteUserIds);
  suggestObj.downVoteUserIds = removeId(userId, suggestObj.downVoteUserIds);

  if (vote === "up") {
    suggestObj.upVoteUserIds.push(userId);
  } else if (vote === "down") {
    suggestObj.downVoteUserIds.push(userId);
  }
  return session;
}

function addInvitation(session: SessionDb, userId: string): SessionDb {
  const existingInvite = session.invitations.find(
    (invite) => invite.userId === userId,
  );
  if (!existingInvite) {
    session.invitations.push({
      userId,
      accepted: false,
      attending: "undecided",
    });
  }
  return session;
}

function makeUserDb(props?: AllOptional<UserDb>): UserDb {
  const user: UserDb = {
    id: urlid(),
    name: "Unnamed User",
    ownsSessions: [],
    invitedSessions: [],
    ...props,
  };
  return user;
}

const USER: ResourceDef<UserDb> = {
  database: "indecisive",
  name: "users",
  singular: "user",
  paramName: "userId",
  sortBy: "name",
  builder: makeUserDb,
};

const SESSION: ResourceDef<SessionDb> = {
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

function canViewSession(session: SessionDb, userId: string): boolean {
  return (
    userId === session.ownerId || getInvitation(session, userId) !== undefined
  );
}

function authSessionOwner(paths: any) {
  return async (ctx: Context, next: Next) => {
    const {
      self,
      session,
      auth: { scope },
    } = ctx.state;

    if (scope?.includes("admin")) {
      log(`authSessionOwner() allowing admin auth ${scope}`);
      await next();
      return;
    }

    if (ctx.request.method === "POST") {
      log(ctx.request);
      log(ctx.router.opts);
      log(ctx.routerName);
      log(ctx.captures);

      if (self.id !== session.ownerId) {
        const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they are not the owner (name: ${session.name}).`;
        console.error(message);
        ctx.status = 403;
        ctx.body = {
          status: "Forbidden",
          message,
        };
        return;
      }
    }

    await next();
  };
}

function authOwnerInvite() {
  return async (ctx: Context, next: Next) => {
    const { self, session } = ctx.state;

    if (!canViewSession(session, self.id)) {
      const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
      console.error(message);
      ctx.status = 403;
      ctx.body = {
        status: "Forbidden",
        message,
      };
      return;
    }

    await next();
  };
}

function fetchCurrentSession(errorIfMissing: boolean = true) {
  return async (ctx: Context, next: Next) => {
    const {
      auth: {
        user: { currentSessionId },
      },
    } = ctx.state;
    if (currentSessionId) {
      ctx.state.currentSession = await fetchSession(currentSessionId);
    } else {
      console.error(`No current session associated with clientId.`);
      if (errorIfMissing) {
        ctx.status = 400;
        ctx.body = {
          status: "error",
          message: "No current session associated with this clientId.",
        };
        return;
      }
    }
    if (!ctx.state.currentSession) {
      console.error(`Current session id '${currentSessionId}' is missing.`);
      if (errorIfMissing) {
        ctx.status = 400;
        ctx.body = {
          status: "error",
          message: `Current session id '${currentSessionId}' is missing.`,
        };
        return;
      }
    }
    await next();
  };
}

function indecisiveAuth(
  authEnabled: boolean,
  requireSelf: boolean,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  skipAuthValue?: any,
) {
  return async (ctx: Context, next: Next) => {
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

async function preCreateSession(
  ctx: Context,
  session: SessionDb,
): Promise<SessionDb> {
  const {
    state: { self },
  } = ctx;
  log(`Assigning ownerId ${self.id} to new session  ${session.name}`);
  session.ownerId = self.id;
  session.invitations = [];
  session.suggestions = [];
  return session;
}

async function postCreateSession(
  ctx: Context,
  session: SessionDb,
): Promise<SessionDb> {
  const {
    state: { self },
  } = ctx;
  log(`Assigning ownerId ${self.id} to new session  ${session.name}`);
  await addUserSessionRef("ownership", session.id, self.id, self);
  // TODO: Make new session the current session
  return session;
}

async function filterSessionCollection(
  ctx: Context,
  session: SessionDb,
): Promise<SessionDb | undefined> {
  const { self } = ctx.state;
  log(`Filtering for ${self.id}`, session);
  if (!canViewSession(session, self.id)) {
    return undefined;
  }
  return session;
}

function removeId(id: string, ids: string[]): string[] {
  return ids.filter((i) => i !== id);
}

async function addUserSessionRef(
  refType: "invitation" | "ownership",
  sessionId: string,
  userId: string,
  user?: UserDb,
): Promise<UserDb | undefined> {
  if (!user) {
    user = await fetchUser(userId);
  }
  if (user) {
    if (refType === "invitation") {
      // ensure uniqueness
      const updated = removeId(sessionId, user.invitedSessions);
      updated.push(sessionId);
      user.invitedSessions = updated;
    } else {
      // ensure uniqueness
      const updated = removeId(sessionId, user.ownsSessions);
      updated.push(sessionId);
      user.ownsSessions = updated;
    }
    const ref = refWithId(USER, user.id);
    log(`Adding session ${refType} ${sessionId} to user ${user.id}`, user);
    await writeResource(ref, user);
    return user;
  }
}

async function removeUserSessionRef(
  refType: "invitation" | "ownership",
  sessionId: string,
  userId: string,
  user?: UserDb,
): Promise<UserDb | undefined> {
  if (!user) {
    user = await fetchUser(userId);
  }
  if (user) {
    if (refType === "invitation") {
      user.invitedSessions = removeId(sessionId, user.invitedSessions);
    } else {
      user.ownsSessions = removeId(sessionId, user.ownsSessions);
    }
    const ref = refWithId(USER, user.id);
    log(`Removing session ${refType} ${sessionId} from user ${user.id}`, user);
    await writeResource(ref, user);
    return user;
  }
}

async function preCreateUser(ctx: Context, user: UserDb): Promise<UserDb> {
  if (user.ownsSessions === undefined) {
    user.ownsSessions = [];
  }
  if (user.invitedSessions === undefined) {
    user.invitedSessions = [];
  }

  return user;
}

async function postGetUser(ctx: Context, user: UserDb): Promise<UserDb> {
  let needsUpdate = false;
  if (user.ownsSessions === undefined) {
    needsUpdate = true;
    user.ownsSessions = [];
  }
  if (user.invitedSessions === undefined) {
    needsUpdate = true;
    user.invitedSessions = [];
  }

  if (needsUpdate) {
    const ref = refWithId(USER, user.id);
    await writeResource(ref, user);
  }

  return user;
}

async function postDeleteSession(
  ctx: Context,
  session: SessionDb,
): Promise<SessionDb> {
  const {
    state: { self },
  } = ctx;
  log(
    `Remove session ${session.id} from ${session.invitations.length} invited users' lists (name: ${session.name})`,
  );

  const results = await Promise.allSettled(
    session.invitations.map(async (invitation) =>
      removeUserSessionRef("invitation", session.id, invitation.userId),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "Promise rejected removing invitation from user:",
        result.reason,
      );
    }
  }

  log(
    `Remove session ${session.id} from ownerId ${self.id} named ${session.name}`,
  );
  if (self.id === session.ownerId) {
    await removeUserSessionRef("ownership", session.id, session.ownerId, self);
  } else {
    console.error(
      `Session ${session.id} ownerId ${session.ownerId} !== ${self.id} named ${session.name}`,
    );
  }

  return session;
}

const SKIP_AUTH = {
  user: {
    username: "no-auth",
    userId: "tamatoa",
    currentSessionId: "FhmzKh_kDQ",
  },
  scope: ["read", "write", "admin"],
};

export function indecisiveRoutes(router: Router) {
  // INDECISIVE AUTH
  const authEnabled = true;
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

  getCollection(router, USER, {
    postProcess: postGetUser,
  });
  getResource(router, USER, undefined, {
    postProcess: postGetUser,
  });
  postResource(router, USER, {
    preProcess: preCreateUser,
  });
  putResource(router, USER);

  getCollection(router, SESSION, {
    postProcess: filterSessionCollection,
  });
  // Post to session means: create a new session owned by me
  postResource<SessionDb>(router, SESSION, {
    preProcess: preCreateSession,
    postProcess: postCreateSession,
  });

  const sessionOwnerRoutes = new Router();
  routerParam(sessionOwnerRoutes, SESSION);
  sessionOwnerRoutes.use(
    ["/sessions/:sessionId", "/sessions/:sessionId/(.*)"],
    authSessionOwner([
      {
        method: "POST",
      },
    ]),
  );
  // Put to session updates session (if owned by me)
  putResource(sessionOwnerRoutes, SESSION);
  deleteResource(sessionOwnerRoutes, SESSION, {
    postProcess: postDeleteSession,
  });

  // TODO: create middleware that enforces session owner or admin
  const sessionOwnerInviteRoutes = new Router();
  routerParam(sessionOwnerInviteRoutes, SESSION);
  sessionOwnerInviteRoutes.use(
    ["/sessions/:sessionId/(.*)"],
    authOwnerInvite(),
  );

  getResource(sessionOwnerInviteRoutes, SESSION);

  sessionOwnerInviteRoutes.post(
    "session-invite",
    "/sessions/:sessionId/invite",
    async (ctx: Context, next: Next) => {
      const { self, session } = ctx.state;

      assert(session);
      // only allow owner to do this
      // TODO: or if has admin scope
      assert(self.id === session.ownerId);

      const { userId } = ctx.request.body;
      assert(userId);
      const invitedUser = await fetchUser(userId);
      if (invitedUser === undefined) {
        ctx.status = 400;
        ctx.body = {
          status: "error",
          message: `Invited user id '${userId}' does not exist.`,
        };
        return;
      }

      addInvitation(session, userId);

      // add invitation to session
      const ref = refWithId(SESSION, session.id);
      const filename = await writeResource(ref, session);
      console.log(`POST written to ${filename} session:`, session);

      // add invitation to user
      await addUserSessionRef("invitation", session.id, userId);

      ctx.body = session;
      await next();
    },
  );

  sessionOwnerInviteRoutes.post(
    "session-respond",
    "/sessions/:sessionId/respond",
    async (ctx: Context, next: Next) => {
      const { self, session } = ctx.state;

      assert(self, "Self must be defined");
      assert(session, "Session must be defined");

      if (!getInvitation(session, self.id)) {
        console.error(
          `User '${self.id}' cannot respond to '${session.id}' because they were not invited to the session (name: ${session.name}).`,
        );
        ctx.status = 400;
        ctx.body = {
          status: "error",
          message: `User '${self.id}' cannot respond to '${session.id}' because they were not invited to the session (name: ${session.name}).`,
        };
        return;
      }

      // TODO: validate parameters
      const { accepted, attending } = ctx.request.body;
      log(
        `Updating ${self.id} response to ${session.id} to accepted: ${accepted} attending: '${attending}'`,
      );

      // update self response
      updateResponse(session, self.id, accepted, attending);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const filename = await writeResource(ref, session);
      console.log(`POST written to ${filename} session:`, session);

      ctx.body = session;
      await next();
    },
  );

  sessionOwnerInviteRoutes.post(
    "session-suggest",
    "/sessions/:sessionId/suggest",
    async (ctx: Context, next: Next) => {
      const { self, session } = ctx.state;

      assert(self, "Self must be defined");
      assert(session, "Session must be defined");

      // if (self.id !== session.ownerId && !getInvitation(session, self.id)) {
      //   const message = `User '${self.id}' cannot respond to '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
      //   console.error(message);
      //   ctx.status = 400;
      //   ctx.body = {
      //     status: "error",
      //     message,
      //   };
      //   return;
      // }

      // TODO: validate parameters
      const { name } = ctx.request.body;
      log(`User ${self.id} adding suggestion to ${session.id}: ${name}`);

      // add suggestion
      addSuggestion(session, self.id, name);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const filename = await writeResource(ref, session);
      console.log(`POST written to ${filename} session:`, session);

      ctx.body = session;
      await next();
    },
  );

  sessionOwnerInviteRoutes.post(
    "suggestion-vote",
    "/sessions/:sessionId/vote/:suggestionId",
    async (ctx: Context, next: Next) => {
      const { self, session } = ctx.state;

      assert(self, "Self must be defined");
      assert(session, "Session must be defined");

      // if (self.id !== session.ownerId && !getInvitation(session, self.id)) {
      //   const message = `User '${self.id}' cannot vote on '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
      //   console.error(message);
      //   ctx.status = 400;
      //   ctx.body = {
      //     status: "error",
      //     message,
      //   };
      //   return;
      // }

      // find suggestion
      const { suggestionId } = ctx.params;
      const suggestion = getSuggestion(session, suggestionId);
      if (!suggestion) {
        ctx.status = 404;
        return;
      }

      // TODO: validate parameters
      const { vote } = ctx.request.body;
      log(
        `User ${self.id} voting ${vote} for ${suggestionId} on ${session.id}`,
      );

      // update suggestion
      updateSuggestion(session, suggestion, self.id, vote);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const filename = await writeResource(ref, session);
      console.log(`POST written to ${filename} session:`, session);

      ctx.body = session;
      await next();
    },
  );

  router.get("test-html", "/test", async (ctx) => {
    const { auth, self } = ctx.state;
    let body = "";
    body += `<p>Auth userId: ${auth?.user?.userId}</p>`;
    body += `<p>Scopes: ${auth?.scope?.join(" ")}</p>`;
    body += `<p>Self id: ${self?.id}</p>`;
    body += `<p>Self name: ${self?.name}</p>`;
    // body += `<p>Client id: ${auth.client.id}</p>`;
    // body += `<p>Client grants: ${auth.client.grants}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: self.id,
    })}">${self.name}</a></p>\n`;
    ctx.body = body;
  });

  router.get("self", "/self", async (ctx) => {
    const { self, auth } = ctx.state;
    console.log("/self auth", auth);
    ctx.body = self;
  });

  router.get("current-session", "/current-session", async (ctx) => {
    const { currentSession } = ctx.state;
    ctx.body = currentSession;
  });

  router.use(sessionOwnerRoutes.routes());
  router.use(sessionOwnerRoutes.allowedMethods());

  router.use(sessionOwnerInviteRoutes.routes());
  router.use(sessionOwnerInviteRoutes.allowedMethods());
}
