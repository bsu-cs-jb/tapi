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
  Invitation,
  Suggestion,
} from "./indecisive_types.js";
import { log, assert, AllOptional } from "./utils.js";
import { urlid } from "./genid.js";

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

export interface SessionDb extends IdResource {
  id: string;
  ownerId: string;
  name: string;
  invitations: InvitationDb[];
  suggestions: Suggestion[];
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

// const INVITATIONS: ResourceDef = {
//   database: "indecisive",
//   name: "invitations",
//   singular: "invitation",
//   paramName: "invitationSessionId",
//   sortBy: "name",
//   parents: [USER],
// };
//
// const OWN_SESSION: ResourceDef = {
//   database: "indecisive",
//   name: "owns",
//   singular: "session",
//   paramName: "sessionId",
//   sortBy: "name",
//   parents: [USER],
// };

// function makeSessionDb(props?: AllOptional<SessionDb>):SessionDb {
//   return {
//     ...props,
//     id: urlid(),
//     ownerId: urlid(),
//     name: "Unnamed Session",
//     invitations: [],
//     suggestions: [],
//   };
// }

const SESSION: ResourceDef<SessionDb> = {
  database: "indecisive",
  name: "sessions",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
  // builder: makeSessionDb,
};

async function fetchUser(id: string): Promise<UserDb | undefined> {
  return readResource<UserDb>(refWithId(USER, id));
}

async function fetchSession(id: string): Promise<SessionDb | undefined> {
  return readResource<SessionDb>(refWithId(SESSION, id));
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

  getCollection(router, USER, {
    postProcess: postGetUser,
  });
  // getResource(router, USER, [OWN_SESSION, INVITATIONS]);
  getResource(router, USER, undefined, {
    postProcess: postGetUser,
  });
  postResource(router, USER, {
    preProcess: preCreateUser,
  });
  putResource(router, USER);

  // getCollection(router, OWN_SESSION);
  // getResource(router, OWN_SESSION);
  // postResource(router, OWN_SESSION);

  getCollection(router, SESSION);
  getResource(router, SESSION);
  // Post to session means: create a new session owned by me
  postResource<SessionDb>(router, SESSION, {
    preProcess: preCreateSession,
    postProcess: postCreateSession,
  });
  // Put to session updates session (if owned by me)
  putResource(router, SESSION);
  deleteResource(router, SESSION, {
    postProcess: postDeleteSession,
  });

  // TODO: create middleware that enforces session owner or admin

  router.post(
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

  router.post(
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

  // router.post("session-respond", "/sessions/:sessionId/respond", async (ctx) => {
  // router.post("session-suggest", "/sessions/:sessionId/suggest", async (ctx) => {
  // router.put("session-vote", "/sessions/:sessionId/vote/:suggestionId", async (ctx) => {

  router.get("test-html", "/test", async (ctx) => {
    const {
      state: { auth, self },
    } = ctx;
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
    const {
      state: { self, auth },
    } = ctx;
    console.log("/self auth", auth);
    ctx.body = self;
  });

  router.get("current-session", "/current-session", async (ctx) => {
    const {
      state: { currentSession },
    } = ctx;
    ctx.body = currentSession;
  });

  // Create a new session owned by this user
  router.post("user-sessions", "/users/:userId/owns", async (ctx) => {
    const { user } = ctx.state;
    let body = `<p>User id: ${user.id}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: user.id,
    })}">${user.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });

  router.get("user-sessions-html", "/users/:userId/sessions", async (ctx) => {
    const { user } = ctx.state;
    let body = `<p>User id: ${user.id}</p>`;
    body += `<p>User: <a href="${router.url("user-html", {
      userId: user.id,
    })}">${user.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });
}
