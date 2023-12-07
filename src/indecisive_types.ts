import { genid } from "./genid";
import { AllOptional, cycle } from "./utils";

/**
 * DO NOT change this file.
 */

export interface User {
  id: string;
  name: string;
}

export type Vote = "up" | "down" | "none";
export const VOTES: Vote[] = ["up", "down", "none"];

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

export function nextAttending(attending: Attending): Attending {
  return cycle(ATTENDING, attending);
}

export interface Invitation {
  user: User;
  accepted: boolean;
  attending: Attending;
}

export interface Session {
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
    id: genid(),
    name: "Unnamed",
    ...props,
  };
}

export function makeSuggestion(props?: AllOptional<Suggestion>): Suggestion {
  return {
    id: genid(),
    name: "Unnamed",
    upVoteUserIds: [],
    downVoteUserIds: [],
    ...props,
  };
}

export function makeInvitation(props?: AllOptional<Invitation>): Invitation {
  return {
    user: {
      id: genid(),
      name: "Unnamed",
    },
    accepted: false,
    attending: "undecided",
    ...props,
  };
}

export function makeSession(props?: AllOptional<Session>): Session {
  return {
    id: genid(),
    owner: {
      id: genid(),
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
