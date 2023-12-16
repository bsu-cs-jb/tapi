import { info, error } from "./logging.js";
import { config } from "../config.js";
import { AllOptional, makeId } from "../utils.js";
import { refWithId, writeJsonToFile, writeResource } from "../FileDb.js";

import { RUBRIC } from "../grader.js";

import {
  Rubric,
  RubricItem,
  RubricCategory,
  makeRubricCategory,
  makeRubricItem,
  makeRubric,
} from "grading";

function mkCategory(
  name: string,
  itemDefs: AllOptional<RubricItem>[],
  bonus: number = 5,
  penalty: number = -5,
): RubricCategory {
  const id = makeId(name);

  function makeItemId(rubricId: string, index: number): string {
    return `${rubricId}-${(index + 1).toString().padStart(3, "0")}`;
  }

  const items: RubricItem[] = itemDefs.map((el, i) => {
    return makeRubricItem({
      id: makeItemId(id, i),
      name: el.name,
      scoreType: el.scoreType || "full_half",
      scoreValue: el.scoreValue || "points",
      pointValue: el.pointValue || 1,
    });
  });

  items.push(
    makeRubricItem({
      id: `${id}-098`,
      name: `${name} bonus`,
      scoreType: "points",
      scoreValue: "bonus",
      pointIncrement: 0.5,
      pointValue: bonus,
    }),
  );
  items.push(
    makeRubricItem({
      id: `${id}-099`,
      name: `${name} penalty`,
      scoreType: "points",
      scoreValue: "penalty",
      pointIncrement: 0.5,
      pointValue: penalty,
    }),
  );
  return makeRubricCategory({
    id,
    name,
    items,
  });
}

async function saveRubric(rubric: Rubric) {
  const ref = refWithId(RUBRIC, rubric.id);
  await writeResource(ref, rubric, { skipCommit: true });
}

async function makeP3a(saveInDb: boolean = true) {
  const usability = mkCategory("Usability", [
    {
      name: "Text is rendered in a font large enough to read on a moderately sized mobile phone.",
    },
    {
      name: "All interactive elements have a reaction when the user taps on them (use Button, Touchable, or properly implemented Pressable)",
    },
    {
      name: "Interactive elements that are disabled have a different appearance and do not react when the user taps on them.",
    },
    {
      name: "Popups or dialogs are rendered properly.",
    },
    {
      name: "UI elements remain visible even if the suggestion or friends name is long.",
    },
  ]);

  const accepting = mkCategory("Accepting", [
    {
      name: `On app launch the user has not yet accepted the invitation and the app displays the user as "not accepted".`,
    },
    {
      name: "The user can see the list of suggestions and invitations before they have accepted the invitation but they cannot vote, add suggestions, update their attendance, or invite other users until they accept the invitation",
    },
    {
      name: "User can accept the invitation. After accepting, the user can vote on suggestions, add new suggestions, update their attendance, and invite other users.",
    },
    {
      name: "Once the user has accepted the invitation, they can update whether they are planning to attend the event or not. Options are: Yes, No, Undecided.",
    },
  ]);

  const suggestions = mkCategory("Suggestions", [
    {
      name: `Displays all suggestions in a scrolling view (ScrollView or FlatList)`,
    },
    {
      name: `Allows a user to vote any number of suggestions`,
    },
    {
      name: `Allows a user to remove their vote from a suggestion`,
    },
    {
      name: `Clearly displays which suggestions the user has voted for`,
    },
    {
      name: `Displays the total vote count for each suggestion`,
    },
    {
      name: `Has a button to let a user add a new suggestion which prompts the user for their suggestion.`,
    },
    {
      name: `Calls the addSuggestion method from AppState to add the new suggestion and displays the updated list of suggestions when it is updated from the backend.`,
    },
  ]);

  const invitations = mkCategory("Invitations", [
    {
      name: `Displays all invited users in a scrolling view (ScrollView or FlatList)`,
    },
    {
      name: `Displays invited users who have not yet accepted the invitation with a different (e.g. grayed out) appearance. These users have not indicated if they are attending or not and their attending status should either not be shown at all or shown distinct from other status.`,
    },
    {
      name: `For users that have accepted the invitation, the app displays whether they are planning to attend the event or not or if they are undecided.`,
    },
    {
      name: `Has a button to let a user invite a friend which prompts the user for their friends name.`,
    },
    {
      name: `Calls the inviteUser method and the display updates after the new user is added.`,
    },
  ]);

  const liveUpdates = mkCategory("Live Updates", [
    {
      name: `When users change their votes, the updates are reflected in the app.`,
      pointValue: 2,
    },
    {
      name: `When the application fetches new suggestions they are properly displayed`,
    },
    {
      name: `When the application fetches new users they are properly displayed`,
    },
  ]);

  const code = mkCategory("Code", [
    {
      name: `Code Review`,
      scoreType: "points",
      pointValue: 5,
    },
  ]);

  const p3a_test = makeRubric({
    id: "test-project-03a",
    name: "Project 3a (test)",
    categories: [
      usability,
      accepting,
      suggestions,
      invitations,
      liveUpdates,
      code,
    ],
  });

  const p3a = makeRubric({
    id: "project-03a",
    name: "Project 3a",
    categories: [
      usability,
      accepting,
      suggestions,
      invitations,
      liveUpdates,
      code,
    ],
  });

  if (saveInDb) {
    await saveRubric(p3a_test);
    await saveRubric(p3a);
  } else {
    await writeJsonToFile("project-03a.json", p3a);
  }
}

async function makeP3b(saveInDb: boolean = true) {
  const auth = mkCategory("Authentication", [
    {
      name: "Properly requests token using client credentials.",
    },
    {
      name: "Uses Bearer Token to make subsequent requests",
    },
  ]);

  const session = mkCategory("Self & Current Session", [
    {
      name: `Fetches self after fetching token`,
    },
    {
      name: `Fetches current session after fetching token`,
    },
    {
      name: `Fetches current session on the update interval`,
    },
    {
      name: `Properly displays the fetched values for self and current session`,
    },
    {
      name: `Updates the UI to reflect changes in the current session`,
    },
  ]);

  const acceptAttend = mkCategory("Responding: Accept & Attend", [
    {
      name: `User can accept an invitation`,
    },
    {
      name: `User can update their attendance`,
    },
  ]);

  const suggestVote = mkCategory("Suggest & Vote", [
    {
      name: `User can add new suggestions`,
    },
    {
      name: `User can vote suggestions up or down or remove votes`,
      pointValue: 2,
    },
    {
      name: `Votes by other users are properly displayed and updated`,
    },
  ]);

  const invite = mkCategory("Invitations", [
    {
      name: `User can invite other users by user id`,
    },
    {
      name: `Invitations by other users are properly displayed and updated`,
    },
    {
      name: `Missing userIds are displayed to the user`,
      scoreValue: "bonus",
    },
  ]);

  const code = mkCategory("Code", [
    {
      name: `Hooks and dependencies are properly specified for API methods`,
      scoreType: "points",
      pointValue: 1,
    },
    {
      name: `Code Review`,
      scoreType: "points",
      pointValue: 4,
    },
    {
      name: `Request errors are shown to the user`,
      scoreValue: "bonus",
      pointValue: 1,
    },
  ]);

  const p3b_test = makeRubric({
    id: "test-project-03b",
    name: "Project 3b (test)",
    categories: [auth, session, acceptAttend, suggestVote, invite, code],
  });

  const p3b = makeRubric({
    id: "project-03b",
    name: "Project 3b",
    categories: [auth, session, acceptAttend, suggestVote, invite, code],
  });

  if (saveInDb) {
    await saveRubric(p3b_test);
    await saveRubric(p3b);
  } else {
    await writeJsonToFile("project-03b.json", p3b);
  }
}

async function main(args: string[]) {
  info("Args:", { args });
  info(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  info(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  if (args.includes("make-p3a")) {
    await makeP3a();
  }
  if (args.includes("make-p3b")) {
    await makeP3b();
  }
}

main(process.argv.slice(2))
  .then(() => {
    console.log("main finished");
  })
  .catch((err) => {
    error("Error running setup:main()", err);
  });
