import { info, error } from "./logging.js";
import { config } from "../config.js";
import { AllOptional } from "../utils.js";
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
  penalty: number = 5,
): RubricCategory {
  const id = name.toLowerCase();

  const items: RubricItem[] = itemDefs.map((el, i) => {
    return makeRubricItem({
      id: `${id}-${i.toString().padStart(3, "0")}`,
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
  // await writeResource(ref, rubric, { updateTimestamps: false });
  await writeResource(ref, rubric, { skipCommit: true });
}

async function makeP3a(saveInDb: boolean = true) {
  const usability = mkCategory("Usability", [
    {
      name: "Text is rendered in a font large enough to read on a moderately sized mobile phone.",
    },
  ]);

  const accepting = makeRubricCategory({
    id: "accepting",
    name: "Accepting",
  });

  const p3a = makeRubric({
    id: "project-03a",
    name: "Project 3a",
    categories: [usability, accepting],
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
