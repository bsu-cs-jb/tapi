import { Context, Next } from "koa";
import Router from "@koa/router";
import * as _ from "lodash-es";

import { authenticate } from "./oauth2/koa.js";
import { refWithId, writeResource } from "./FileDb.js";
import {
  deleteResource,
  getCollection,
  getResource,
  postResource,
  putResource,
  routerParam,
} from "./RestAPI.js";

import { fetchUser, fetchSession, SESSION, USER } from "./IndecisiveDb.js";
import {
  toSession,
  toSessionDb,
  addInvitation,
  getSuggestion,
  updateResponse,
  getInvitation,
  addSuggestion,
  updateSuggestion,
  canViewSession,
  UserDb,
  SessionDb,
} from "./IndecisiveTypes.js";
import { Session } from "./indecisive_rn_types.js";
import { assert, removeId } from "./utils.js";
import { log, logger } from "./logging.js";

interface PathDef {
  method: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
  endsWith?: string;
}

function pathDefsMatch(ctx: Context, paths: PathDef[]): boolean {
  for (const pathDef of paths) {
    if (ctx.request.method !== pathDef.method) {
      continue;
    }
    if (pathDef.endsWith !== undefined) {
      if (!ctx._matchedRoute.endsWith(pathDef.endsWith)) {
        continue;
      }
    }
    return true;
  }

  return false;
}

function authSessionOwner(paths: PathDef[]) {
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

    // log("ctx.request.method:", ctx.request.method);
    // log("ctx._matchedRoute:", ctx._matchedRoute);
    if (pathDefsMatch(ctx, paths)) {
      // log("authOwnerInvite() matches spec");

      if (self.id !== session.ownerId) {
        const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they are not the owner (name: ${session.name}).`;
        logger.error(message);
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

function authOwnerInvite(paths: PathDef[]) {
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

    // log("ctx.request.method:", ctx.request.method);
    // log("ctx._matchedRoute:", ctx._matchedRoute);
    if (pathDefsMatch(ctx, paths)) {
      // log("authOwnerInvite() matches spec");

      if (!canViewSession(session, self.id)) {
        const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
        logger.error(message);
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

function _authOwnerInvite_2() {
  return async (ctx: Context, next: Next) => {
    const { self, session } = ctx.state;

    if (!canViewSession(session, self.id)) {
      const message = `User '${self.id}' cannot perform this operation on session '${session.id}' because they were not invited to the session and are not the owner (name: ${session.name}).`;
      logger.error(message);
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
      logger.error(`No current session associated with clientId.`);
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
      logger.error(`Current session id '${currentSessionId}' is missing.`);
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
      logger.error("No userId found in ctx.state.auth");
    }

    // if self is required, then error on missing self
    if (requireSelf && !ctx.state.self) {
      const message = `User '${userId}' associated with your clientId not found.`;
      ctx.status = 500;
      ctx.body = {
        status: "error",
        message,
      };
      logger.error(message);
      return;
    }
    await next();
  };
}

const preCreateSession = async (
  ctx: Context,
  session: SessionDb,
  body: Session,
): Promise<SessionDb> => {
  const { self } = ctx.state;
  // log(`Assigning ownerId ${self.id} to new session ${session.name}`);
  if (body.accepted === undefined) {
    body.accepted = true;
  }
  if (body.attending === undefined) {
    body.attending = "yes";
  }
  const newSessionDb = toSessionDb(body, self.id);
  newSessionDb.ownerId = self.id;
  return newSessionDb;
};

async function postCreateSession(
  ctx: Context,
  session: SessionDb,
): Promise<Session> {
  const { self } = ctx.state;
  // log(`Persisting ownerId ${self.id} to new session  ${session.name}`);
  await addUserSessionRef("ownership", session.id, self.id, self);
  // TODO: Make new session the current session
  return await toSession(session, self.id);
}

async function ppSessionToDb(
  ctx: Context,
  session: SessionDb,
  body: Session,
): Promise<SessionDb> {
  const { self } = ctx.state;
  return toSessionDb(body, self.id);
}

async function ppSessionDbToSession(
  ctx: Context,
  session: SessionDb,
): Promise<Session> {
  const { self } = ctx.state;
  return await toSession(session, self.id);
}

async function filterSessionCollection(
  ctx: Context,
  session: SessionDb,
): Promise<Session | undefined> {
  const { self } = ctx.state;
  // log(`Filtering for ${self.id}`, session);
  if (!canViewSession(session, self.id)) {
    return undefined;
  }
  return await toSession(session, self.id);
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
    // log(`Adding session ${refType} ${sessionId} to user ${user.id}`, user);
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
    // log(`Removing session ${refType} ${sessionId} from user ${user.id}`, user);
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
  // log(
  //   `Remove session ${session.id} from ${session.invitations.length} invited users' lists (name: ${session.name})`,
  // );

  const results = await Promise.allSettled(
    session.invitations.map(async (invitation) =>
      removeUserSessionRef("invitation", session.id, invitation.userId),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        "Promise rejected removing invitation from user:",
        result.reason,
      );
    }
  }

  // log(
  //   `Remove session ${session.id} from ownerId ${self.id} named ${session.name}`,
  // );
  if (self.id === session.ownerId) {
    await removeUserSessionRef("ownership", session.id, session.ownerId, self);
  } else {
    logger.error(
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
    ["/sessions/:sessionId"],
    authSessionOwner([
      {
        method: "DELETE",
        endsWith: "/sessions/:sessionId",
      },
      {
        method: "PUT",
        endsWith: "/sessions/:sessionId",
      },
    ]),
  );
  // Put to session updates session (if owned by me)
  putResource(sessionOwnerRoutes, SESSION, {
    preProcess: ppSessionToDb,
  });
  deleteResource(sessionOwnerRoutes, SESSION, {
    postProcess: postDeleteSession,
  });

  const sessionOwnerInviteRoutes = new Router();
  routerParam(sessionOwnerInviteRoutes, SESSION);
  sessionOwnerInviteRoutes.use(
    [
      "/sessions/:sessionId/invite",
      "/sessions/:sessionId/respond",
      "/sessions/:sessionId/suggest",
      "/sessions/:sessionId/vote/:voteId",
    ],
    authOwnerInvite([
      {
        method: "POST",
        endsWith: "/sessions/:sessionId/invite",
      },
      {
        method: "POST",
        endsWith: "/sessions/:sessionId/respond",
      },
      {
        method: "POST",
        endsWith: "/sessions/:sessionId/suggest",
      },
      {
        method: "POST",
        endsWith: "/sessions/:sessionId/vote/:voteId",
      },
    ]),
  );

  getResource(sessionOwnerInviteRoutes, SESSION, undefined, {
    postProcess: ppSessionDbToSession,
  });

  sessionOwnerInviteRoutes.post(
    "session-invite",
    "/sessions/:sessionId/invite",
    async (ctx: Context, next: Next) => {
      const { self, session } = ctx.state;

      assert(session, "session");

      const { userId } = ctx.request.body;
      assert(userId, "userId");
      log(
        `User ${self.id} inviting ${userId} to session ${session.id} (name: ${session.name})`,
      );
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
      const _filename = await writeResource(ref, session);
      // log(`POST written to ${filename} session:`, session);

      // add invitation to user
      await addUserSessionRef("invitation", session.id, userId);

      ctx.body = await toSession(session, self.id);
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
        logger.error(
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
        `Updating ${self.id} response to ${session.id} to accepted: ${accepted} attending: '${attending}' (name: ${session.name})`,
      );

      // update self response
      updateResponse(session, self.id, accepted, attending);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const _filename = await writeResource(ref, session);
      // log(`POST written to ${filename} session:`, session);

      ctx.body = await toSession(session, self.id);
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
      //   logger.error(message);
      //   ctx.status = 400;
      //   ctx.body = {
      //     status: "error",
      //     message,
      //   };
      //   return;
      // }

      // TODO: validate parameters
      const { name } = ctx.request.body;
      log(
        `User ${self.id} adding suggestion '${name}  to ${session.id} (name: ${session.name})`,
      );

      // add suggestion
      addSuggestion(session, self.id, name);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const _filename = await writeResource(ref, session);
      // log(`POST written to ${filename} session:`, session);

      ctx.body = await toSession(session, self.id);
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
      //   logger.error(message);
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
        ctx.body = {
          status: "error",
          message: `Suggestion id '${suggestionId}' not found in session ${session.id} (name: ${session.name}).`,
        };
        return;
      }

      // TODO: validate parameters
      const { vote } = ctx.request.body;
      log(
        `User ${self.id} voting ${vote} for ${suggestionId} on ${session.id} (name: ${session.name})`,
      );

      // update suggestion
      updateSuggestion(session, suggestion, self.id, vote);

      // persist session
      const ref = refWithId(SESSION, session.id);
      const _filename = await writeResource(ref, session);
      // log(`POST written to ${filename} session:`, session);

      ctx.body = await toSession(session, self.id);
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
    body += `<p>User: <a href="${router.url("user-html", {
      userId: self.id,
    })}">${self.name}</a></p>\n`;
    ctx.body = body;
  });

  router.get("self", "/self", async (ctx) => {
    const { self } = ctx.state;
    // log("/self auth", auth);
    ctx.body = self;
  });

  router.get(
    "current-session",
    "/current-session",
    async (ctx: Context, next: Next) => {
      const { self, currentSession } = ctx.state;
      ctx.body = await toSession(currentSession, self.id);

      await next();
    },
  );

  router.use(sessionOwnerRoutes.routes());
  router.use(sessionOwnerRoutes.allowedMethods());

  router.use(sessionOwnerInviteRoutes.routes());
  router.use(sessionOwnerInviteRoutes.allowedMethods());
}

export const FOR_TESTING = {
  preCreateSession,
};
