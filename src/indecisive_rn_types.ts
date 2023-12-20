import { urlid } from "./utils/genid.js";
import { AllOptional, cycle } from "./utils.js";
import { IdResource } from "./FileDb.js";

/**
 * DO NOT change this file.
 */

export interface User extends IdResource {
  id: string;
  name: string;
}

export type Vote = "up" | "down" | "none";
export const VOTES: Vote[] = ["up", "down", "none"];

export function isVote(value: string): value is Vote {
  return typeof value === "string" && (VOTES as string[]).indexOf(value) != -1;
}

export interface Suggestion {
  id: string;
  name: string;
  upVoteUserIds: string[];
  downVoteUserIds: string[];
}

export type Attending = "yes" | "no" | "undecided";

export const ATTENDING: Attending[] = ["yes", "no", "undecided"];

export function nextVote(vote: Vote): Vote {
  return cycle(VOTES, vote);
}

export function isAttending(value: string): value is Attending {
  return (
    typeof value === "string" && (ATTENDING as string[]).indexOf(value) != -1
  );
}

export function nextAttending(attending: Attending): Attending {
  return cycle(ATTENDING, attending);
}

export interface Invitation {
  user: User;
  accepted: boolean;
  attending: Attending;
}

export interface Session extends IdResource {
  id: string;
  owner: User;
  description: string;
  accepted: boolean;
  attending: Attending;
  invitations: Invitation[];
  suggestions: Suggestion[];
}

export function makeUser(props?: AllOptional<User>): User {
  return {
    id: urlid(),
    name: "Unnamed",
    ...props,
  };
}

export function makeSuggestion(props?: AllOptional<Suggestion>): Suggestion {
  return {
    id: urlid(),
    name: "Unnamed",
    upVoteUserIds: [],
    downVoteUserIds: [],
    ...props,
  };
}

export function makeInvitation(props?: AllOptional<Invitation>): Invitation {
  return {
    user: {
      id: urlid(),
      name: "Unnamed",
    },
    accepted: false,
    attending: "undecided",
    ...props,
  };
}

export function makeSession(props?: AllOptional<Session>): Session {
  return {
    id: urlid(),
    owner: {
      id: urlid(),
      name: "Unnamed",
    },
    description: "empty",
    accepted: false,
    attending: "undecided",
    invitations: [],
    suggestions: [],
    ...props,
  };
}
