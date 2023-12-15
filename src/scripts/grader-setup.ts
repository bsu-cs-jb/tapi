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

  const items: RubricItem[] = itemDefs.map((el, i) => {
    return makeRubricItem({
      id: `${id}-${(i + 1).toString().padStart(3, "0")}`,
      name: el.name,
      scoreType: el.scoreType || "boolean",
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
      pointValue: bonus,
    }),
  );
  items.push(
    makeRubricItem({
      id: `${id}-099`,
      name: `${name} penalty`,
      scoreType: "points",
      scoreValue: "penalty",
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
      name: `On app launch the user has not yet accepted the invitation and the app displays the user as “not accepted”.`,
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
      name: ``,
    },
  ]);

  const invitations = mkCategory("Invitations", [
    {
      name: ``,
    },
  ]);

  const liveUpdates = mkCategory("Live Updates", [
    {
      name: ``,
    },
  ]);

  const code = mkCategory("code", [
    {
      name: ``,
    },
  ]);

  const p3a = makeRubric({
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

  if (saveInDb) {
    await saveRubric(p3a);
  } else {
    await writeJsonToFile("project-03a.json", p3a);
  }
}

async function main(args: string[]) {
  info("Args:", { args });
  info(`LOGGING_ENABLED: ${config.LOGGING_ENABLED}`);
  info(`LOG_LEVEL: ${config.LOG_LEVEL}`);

  if (args.includes("make-p3a")) {
    await makeP3a();
  }
  // await clients();
  // await fakeUsers();
  // await printIds();
}

main(process.argv.slice(2))
  .then(() => {
    console.log("main finished");
  })
  .catch((err) => {
    error("Error running setup:main()", err);
  });
