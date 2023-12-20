import { IdResource } from "./FileDb.js";
import { IdName } from "./RestAPI.js";

import { fetchUser } from "./IndecisiveDb.js";
import {
  Session,
  Attending,
  Vote,
  Invitation,
  Suggestion,
} from "./indecisive_rn_types.js";
import { assert, AllOptional, removeId } from "./utils.js";
import { urlid } from "./utils/genid.js";

export interface UserInvitationDb {
  sessionId: string;
  accepted: boolean;
  attending: Attending;
}

export interface SuggestionDb {
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

export function toInvitationDb(invite: Invitation): InvitationDb {
  return {
    userId: invite.user.id,
    accepted: invite.accepted || false,
    attending: invite.attending || "undecided",
  };
}

export function toSuggestionDb(suggest: Suggestion): SuggestionDb {
  return {
    id: suggest.id,
    name: suggest.name,
    upVoteUserIds: suggest.upVoteUserIds || [],
    downVoteUserIds: suggest.downVoteUserIds || [],
  };
}

export function toSessionDb(session: Session, selfUserId: string): SessionDb {
  const invitations = session.invitations
    ? session.invitations.map(toInvitationDb)
    : [];
  let sessionDb = {
    id: session.id,
    name: session.description,
    ownerId: session.owner?.id || "",
    invitations,
    suggestions: session.suggestions
      ? session.suggestions.map(toSuggestionDb)
      : [],
  };
  sessionDb = addInvitation(
    sessionDb,
    selfUserId,
    session.accepted || false,
    session.attending || "undecided",
    true,
  );
  return sessionDb;
}

export function toIdName(item: IdResource): IdName {
  return {
    id: item.id,
    name: item.name || "",
  };
}

export async function toSession(
  sessionDb: SessionDb,
  selfUserId: string,
): Promise<Session> {
  const userCache: Record<string, UserDb> = {};
  const invitations: Invitation[] = [];
  let selfInvite;
  for (const invite of sessionDb.invitations) {
    // If this is the invite for myself, drop it from the list
    if (invite.userId === selfUserId) {
      selfInvite = invite;
      continue;
    }

    let user;
    if (invite.userId in userCache) {
      user = userCache[invite.userId];
    } else {
      user = await fetchUser(invite.userId);
    }
    if (user) {
      invitations.push({
        user: toIdName(user),
        accepted: invite.accepted,
        attending: invite.attending,
      });
    }
  }
  const suggestions: Suggestion[] = [];
  for (const suggestion of sessionDb.suggestions) {
    suggestions.push({
      id: suggestion.id,
      name: suggestion.name,
      upVoteUserIds: suggestion.upVoteUserIds,
      downVoteUserIds: suggestion.downVoteUserIds,
    });
  }
  const owner = await fetchUser(sessionDb.ownerId);
  return {
    id: sessionDb.id,
    owner: owner
      ? toIdName(owner)
      : {
          id: sessionDb.ownerId,
          name: "Missing owner",
        },
    description: sessionDb.name,
    accepted: selfInvite?.accepted || false,
    attending: selfInvite?.attending || "undecided",
    invitations,
    suggestions,
    updatedAt: sessionDb.updatedAt,
    createdAt: sessionDb.createdAt,
  };
}

export interface UserDb extends IdResource {
  id: string;
  name: string;
  ownsSessions: string[];
  invitedSessions: string[];
}

export function getInvitation(
  session: SessionDb,
  userId: string,
): InvitationDb | undefined {
  return session.invitations.find((i) => i.userId === userId);
}

export function getSuggestion(
  session: SessionDb,
  id: string,
): SuggestionDb | undefined {
  return session.suggestions.find((s) => s.id === id);
}

export function findSuggestionByName(
  session: SessionDb,
  name: string,
): SuggestionDb | undefined {
  return session.suggestions.find((s) => s.name === name);
}

export function updateResponse(
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

export function makeSuggestionDb(name: string): SuggestionDb {
  return {
    id: urlid(),
    name,
    upVoteUserIds: [],
    downVoteUserIds: [],
  };
}

export function addSuggestion(
  session: SessionDb,
  userId: string,
  name: string,
): SessionDb {
  const existingSuggestion = findSuggestionByName(session, name);
  if (existingSuggestion) {
    return session;
  }
  session.suggestions.push(makeSuggestionDb(name));
  return session;
}

export function updateSuggestion(
  session: SessionDb,
  suggestion: string | SuggestionDb,
  userId: string,
  vote: Vote,
): SessionDb {
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

export function addInvitation(
  session: SessionDb,
  userId: string,
  accepted: boolean = false,
  attending: Attending = "undecided",
  updateResponse = false,
): SessionDb {
  const existingInvite = session.invitations.find(
    (invite) => invite.userId === userId,
  );
  if (existingInvite === undefined) {
    session.invitations.push({
      userId,
      accepted,
      attending,
    });
  } else if (existingInvite && updateResponse) {
    existingInvite.accepted = accepted;
    existingInvite.attending = attending;
  }
  return session;
}

export function makeSessionDb(props?: AllOptional<SessionDb>): SessionDb {
  const session: SessionDb = {
    id: urlid(),
    ownerId: "",
    name: "Unnamed User",
    invitations: [],
    suggestions: [],
    ...props,
  };
  return session;
}

export function makeUserDb(props?: AllOptional<UserDb>): UserDb {
  const user: UserDb = {
    id: urlid(),
    name: "Unnamed User",
    ownsSessions: [],
    invitedSessions: [],
    ...props,
  };
  return user;
}

export function canViewSession(session: SessionDb, userId: string): boolean {
  return (
    userId === session.ownerId || getInvitation(session, userId) !== undefined
  );
}
