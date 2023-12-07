import Router from "@koa/router";
import * as _ from "lodash-es";

import { jsonhtml, log } from "./utils.js";
import {
  readResource,
  refWithId,
  ResourceDef,
  writeResource,
} from "./FileDb.js";
import {
  getCollection,
  getResource,
  linkList,
  postResource,
  putResource,
  routerParam,
} from "./RestAPI.js";

import { User, Session, Attending, Invitation, Suggestion } from "./indecisive_types.js";


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

const USER:ResourceDef = {
  database: "indecisive",
  name: "users",
  singular: "user",
  paramName: "userId",
  sortBy: "name",
};

const INVITATIONS:ResourceDef = {
  database: "indecisive",
  name: "invitations",
  singular: "invitation",
  paramName: "invitationSessionId",
  sortBy: "name",
  parents: [USER],
};

const OWN_SESSION:ResourceDef = {
  database: "indecisive",
  name: "owns",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
  parents: [USER],
};

const SESSION:ResourceDef = {
  database: "indecisive",
  name: "sessions",
  singular: "session",
  paramName: "sessionId",
  sortBy: "name",
};

async function fetchUser(id:string): Promise<UserDb|undefined> {
  return readResource<UserDb>(refWithId(USER, id));
}

async function fetchSession(id:string): Promise<SessionDb|undefined> {
  return readResource<SessionDb>(refWithId(SESSION, id));
}

export function indecisiveRoutes(router: Router) {

  router.get("/", async (ctx) => {
    let body = "";
    body += "<!DOCTYPE html>\n<html><head><title>Indecisive Root</title></head><body>";
    body += "<div><p>Indecisive</p><ul>\n";
    [USER, SESSION].forEach((resource) => {
      body += `<li>${_.capitalize(resource.name)}: <a href="${router.url(resource.name+"-html")}">html</a> <a href="${router.url(resource.name)}">json</a></li>\n`;
    });
    body += "</ul></div>\n";
    body += "<div><p>Other links</p><ul>\n";
    body += "<li><a href=\"http://google.com\">Google</a></li>\n";
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

  getCollection(router, SESSION);
  getResource(router, SESSION);
  postResource(router, SESSION);
  putResource(router, SESSION);

  router.post("user-sessions", "/users/:userId/sessions", async (ctx) => {
    const { user } = ctx;
    let body = `<p>User id: ${user.id}</p>`;
    body += `<p>User: <a href="${router.url("user-html", { userId: user.id })}">${user.name}</a></p>\n`;
    // body += linkList(router, STUDENT, course.students, { courseId });
    // body += jsonhtml(course.students);
    ctx.body = body;
  });

  router
    .get("user-sessions-html", "/users/:userId/sessions", async (ctx) => {
      const { user } = ctx;
      let body = `<p>User id: ${user.id}</p>`;
      body += `<p>User: <a href="${router.url("user-html", { userId: user.id })}">${user.name}</a></p>\n`;
      // body += linkList(router, STUDENT, course.students, { courseId });
      // body += jsonhtml(course.students);
      ctx.body = body;
    });

}
