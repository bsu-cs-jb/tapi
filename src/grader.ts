import Router from "@koa/router";
import { Context, Next } from "koa";
import * as _ from "lodash-es";
import { standardDeviation, quantile, median } from "simple-statistics";

import { jsonhtml, toJson } from "./utils/json.js";
import { log } from "./utils/logging.js";
import {
  IdResource,
  readResource,
  refWithId,
  ResourceDef,
  writeJsonToFile,
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
import {
  CourseDbObj,
  CourseGradeDbObj,
  findCategory,
  findInRubric,
  makeCategoryScore,
  makeItemScore,
  makeRubricScore,
  makeStudent,
  Rubric,
  RubricItemScore,
  RubricScore,
  scoreCategory,
  scoreItem,
  scoreRubric,
  Student,
  StudentGradeDbObj,
  updateRubricScore,
  validateRubric,
} from "grading";
import { closeTo } from "./utils/numbers.js";

const COURSE: ResourceDef<CourseDbObj> = {
  database: "grading",
  name: "courses",
  singular: "course",
  paramName: "courseId",
  sortBy: "name",
};

export const RUBRIC: ResourceDef<Rubric> = {
  database: "grading",
  name: "rubrics",
  singular: "rubric",
  paramName: "rubricId",
  // parents: [COURSE],
  sortBy: "name",
};

const STUDENT: ResourceDef<Student> = {
  database: "grading",
  name: "students",
  singular: "student",
  paramName: "studentId",
  builder: makeStudent,
  // parents: [COURSE],
  sortBy: "name",
};

const GRADE: ResourceDef<RubricScore> = {
  database: "grading",
  name: "grades",
  singular: "grade",
  paramName: "gradeId",
  nestFiles: false,
  parents: [STUDENT],
  sortBy: "name",
};

async function fetchStudent(id: string): Promise<Student | undefined> {
  return readResource<Student>(refWithId(STUDENT, id));
}

async function fetchRubricScore(id: string): Promise<RubricScore | undefined> {
  return readResource<RubricScore>(refWithId(GRADE, id));
}

async function fetchGrades(
  course: CourseDbObj,
  rubric: Rubric,
  includeTestStudents = false,
): Promise<RubricScore[]> {
  const cachedFetchStudent = _.memoize(fetchStudent);

  const SKIP_COMPARE_FIELDS = [
    "createdAt",
    "updatedAt",
    // "computedScore",
    // "categories",
  ];

  const gradeRefs = course.grades.filter(
    (grade) => grade.rubricId === rubric.id,
  );
  const grades = await Promise.all(
    (
      await Promise.all(
        gradeRefs.map(async (gradeRef) => {
          if (!includeTestStudents) {
            const student = await cachedFetchStudent(gradeRef.studentId);
            if (student?.test) {
              return undefined;
            }
          }
          const rubricScore = await fetchRubricScore(gradeRef.id);
          return rubricScore;
        }),
      )
    )
      .filter((score): score is RubricScore => score !== undefined)
      .map(async (score) => {
        const updated = updateRubricScore(score, rubric);
        scoreRubric(rubric, score);
        // const customizer = (
        //   value: any,
        //   other: any,
        //   key: unknown,
        // ): true | false | undefined => {
        //   log(`Comparing ${key}`);
        //   if (key === "computedScore") {
        //     log("computedScore is equal");
        //     return true;
        //     if (typeof value === "object") {
        //       console.log("computedScore is equal");
        //       return true;
        //     } else {
        //       return undefined;
        //     }
        //   } else if (typeof value == "number" && typeof other == "number") {
        //     log("float");
        //     return closeTo(value, other);
        //   } else {
        //     return undefined;
        //   }
        // };
        // TODO: this isEqual does not work
        if (
          !_.isEqual(
            _.cloneDeep(_.omit(score, SKIP_COMPARE_FIELDS)),
            _.cloneDeep(_.omit(updated, SKIP_COMPARE_FIELDS)),
          )
        ) {
          // Old-school solution works fine
          if (toJson(score, 0) === toJson(updated, 0)) {
            // TODO: This causes multiple writes to bash each other
            await writeJsonToFile("./origScore.json", score);
            await writeJsonToFile("./updatedScore.json", updated);
            log(
              `**************** grader.ts: _.isEqual() returned false but they are equal ******************`,
            );
          } else {
            log(`Needs updated: ${score.name}`);
            await writeResource(refWithId(GRADE, updated.id), updated);
          }
        }
        return updated;
      }),
  );
  return _.sortBy(grades, "studentName");
}

export async function getOrAddRubricScore(
  course: CourseDbObj,
  student: Student,
  rubric: Rubric,
): Promise<RubricScore | undefined> {
  const foundGrade = course.grades.find(
    (g) => g.studentId === student.id && g.rubricId === rubric.id,
  );
  if (foundGrade) {
    // look this up and return it
    log(
      `Found grade for ${course.name} ${student.name} ${rubric.name}`,
      foundGrade,
    );
    const rubricScore = await readResource<RubricScore>(
      refWithId(GRADE, foundGrade.id),
    );
    // Update this since it wasn't originally saved
    if (rubricScore) {
      rubricScore.studentId = student.id;
      rubricScore.studentName = student.name;
      rubricScore.courseId = course.id;
      rubricScore.courseName = course.name;
      rubricScore.name = `${rubric.name} for ${student.name} in ${course.name}`;
      log(`Updating ${student.name}'s rubric score for ${rubric.name}.`);
      return updateRubricScore(rubricScore, rubric);
    }
    return rubricScore;
  } else {
    // no grade for this rubric for this student
    const rubricScore = makeRubricScore(rubric);
    rubricScore.studentId = student.id;
    rubricScore.studentName = student.name;
    rubricScore.courseId = course.id;
    rubricScore.courseName = course.name;
    rubricScore.name = `${rubric.name} for ${student.name} in ${course.name}`;
    scoreRubric(rubric, rubricScore);
    const gradeRef: CourseGradeDbObj = {
      id: rubricScore.id,
      name: rubric.name,
      rubricId: rubric.id,
      courseId: course.id,
    };
    const studentGrade: StudentGradeDbObj = {
      id: rubricScore.id,
      name: rubric.name,
      rubricId: rubric.id,
      studentId: student.id,
      studentName: student.name,
    };
    student.grades.push(gradeRef);
    course.grades.push(studentGrade);
    await writeResource(refWithId(GRADE, rubricScore.id), rubricScore);
    await writeResource(refWithId(STUDENT, student.id), student);
    await writeResource(refWithId(COURSE, course.id), course);
    return rubricScore;
  }
}

function processRubric(rubric: Rubric): Rubric | undefined {
  const result = validateRubric(rubric);
  if (!result.valid) {
    log(`Rubric ${rubric.name} failed validation. Duplicate ids:`, result);
    return undefined;
  } else {
    log(`validated rubric ${rubric.name}.`);
    return rubric;
  }
}

export function graderRoutes(router: Router) {
  router.get("/", async (ctx: Context, next: Next) => {
    let body = "";
    body +=
      "<!DOCTYPE html>\n<html><head><title>Grader Root</title></head><body>";
    body += "<div><p>Grader collections</p><ul>\n";
    [COURSE, STUDENT, RUBRIC, GRADE].forEach((resource) => {
      body += `<li>${_.capitalize(resource.name)}: <a href="${router.url(
        resource.name + "-html",
      )}">html</a> <a href="${router.url(resource.name)}">json</a></li>\n`;
    });
    body += "</ul></div>\n";
    body += "<div><p>Other links</p><ul>\n";
    body +=
      '<li><a href="http://localhost:3000/grader/courses/CS411-2023-fall/rubrics/project-02/grades.html">Project 2 Grade stats</a></li>\n';
    body += "</ul></div>\n";
    ctx.body = body;

    await next();
  });

  const showRubricStats = (
    course: CourseDbObj,
    body: string,
    router: Router,
  ) => {
    body += "<div><p>Rubric Grade Stats</p><ul>";
    for (const rubric of course.rubrics) {
      body += `<li><a href="${router.url("course-rubric-grades-html", {
        courseId: course.id,
        rubricId: rubric.id,
      })}">${rubric.name} Grade Stats</a></li>`;
    }
    body += "</ul></div>";
    return body;
  };

  routerParam(router, COURSE);
  routerParam(router, RUBRIC, processRubric);
  routerParam(router, STUDENT);
  routerParam(router, GRADE);

  getCollection(router, COURSE);
  // getResource(router, COURSE, [RUBRIC, STUDENT, GRADE], showRubricStats);
  getResource(router, COURSE, [RUBRIC, STUDENT], {
    processHtml: showRubricStats,
  });
  postResource(router, COURSE);
  putResource(router, COURSE);

  getCollection(router, STUDENT);
  getResource(router, STUDENT, [GRADE]);
  postResource(router, STUDENT);
  putResource(router, STUDENT);

  function restRoutes<T extends IdResource>(resource: ResourceDef<T>) {
    getCollection(router, resource);
    getResource(router, resource);
    postResource(router, resource);
    putResource(router, resource);
  }

  restRoutes(RUBRIC);
  restRoutes(GRADE);

  router
    .get(
      "course-students",
      "/courses/:courseId/students",
      async (ctx: Context, next: Next) => {
        const {
          state: { course },
          params: { courseId },
        } = ctx;
        let body = `<p>Course id: ${courseId}</p>`;
        body += `<p>Course: <a href="${router.url("course-html", {
          courseId: course.id,
        })}">${course.name}</a></p>\n`;
        body += linkList(router, STUDENT, course.students, { courseId });
        body += jsonhtml(course.students);
        ctx.body = body;
        await next();
      },
    )
    .get(
      "course-student",
      "/courses/:courseId/students/:studentId",
      async (ctx: Context, next: Next) => {
        const { course, student } = ctx.state;
        let body = "";
        body += `<p>Course: <a href="${router.url("course-html", {
          courseId: course.id,
        })}">${course.name}</a></p>\n`;
        body += `<p>Student: <a href="${router.url("student-html", {
          courseId: course.id,
          studentId: student.id,
        })}">${student.name}</a></p>\n`;
        body += jsonhtml(student);
        ctx.body = body;
        await next();
      },
    )
    .get(
      "course-rubric-grades-html",
      "/courses/:courseId/rubrics/:rubricId/grades.html",
      async (ctx: Context, next: Next) => {
        const { course, rubric } = ctx.state as {
          course: CourseDbObj;
          rubric: Rubric;
        };
        const includeTestStudents: boolean =
          ctx.request?.query?.test === "true";
        let body = "";
        body += `<!DOCTYPE html>\n<html><head><title>${course.name} ${rubric.name} Stats</title></head><body>`;
        body += `<p>Course: <a href="${router.url("course-html", {
          courseId: course.id,
        })}">${course.name}</a></p>\n`;
        body += `<p>Rubric: <a href="${router.url("rubric-html", {
          rubricId: rubric.id,
        })}">${rubric.name}</a></p>\n`;

        const grades = await fetchGrades(course, rubric, includeTestStudents);

        function statsRows(
          scoreList: number[],
          scoreValueList: (number | undefined)[],
        ): string {
          let rows = "";
          rows += `<td>${_.mean(scoreList).toFixed(2)}</td>\n`;
          rows += `<td>${_.min(scoreList)}</td>\n`;
          rows += `<td>${_.max(scoreList)}</td>\n`;

          const distr = Object.entries(_.countBy(scoreList));
          const sortedDistr = _.sortBy(distr, [
            (i: [string, number]) => Number.parseFloat(i[0]),
          ]);
          let distrValue = `${sortedDistr.length} values`;
          if (sortedDistr.length <= 3) {
            distrValue = _.join(
              sortedDistr.map(([k, c]) => `${k}: ${c}`),
              "; ",
            );
          }

          rows += `<td>${distrValue}</td>\n`;
          rows += `<td>${
            scoreValueList.filter((s) => s === undefined).length
          }</td>\n`;
          return rows;
        }

        body += "<table><thead><tr>\n";
        body += "<th>Student</th>\n";
        body += "<th>Score</th>\n";
        body += "<th>Point Value</th>\n";
        body += "<th>Percent</th>\n";
        body += "<th>Unscored</th>\n";
        body += "</tr></thead><tbody>\n";
        for (const rubricScore of grades) {
          const score = rubricScore.computedScore?.score || 0;
          const pointValue = rubricScore.computedScore?.pointValue || 0;
          body += "<tr>";
          body += `<td><a href="${router.url("grade-html", {
            gradeId: rubricScore.id,
          })}">${rubricScore.studentName}</a></td>`;
          body += `<td style="text-align: right">${rubricScore.computedScore?.score}</td>`;
          body += `<td style="text-align: right">${rubricScore.computedScore?.pointValue}</td>`;
          body += `<td style="text-align: right">${(
            (score / pointValue) *
            100
          ).toFixed(0)}%</td>`;
          body += `<td style="text-align: right">${rubricScore.computedScore?.unscoredItems}</td>`;
          body += "</tr>\n";
        }
        body += "</tbody></table>\n";

        body += "<table><thead><tr>\n";
        body += "<th>Student</th>\n";
        body += "<th>Score</th>\n";
        body += "<th>Percent</th>\n";
        body += "<th>Unscored</th>\n";

        const scores: number[] = [];
        const percent: number[] = [];
        const unscored: number[] = [];
        const category_scores: Record<string, number[]> = {};

        for (const category of rubric.categories) {
          body += `<th>${category.name}</th>\n`;
          category_scores[category.id] = [];
        }
        body += "</tr></thead><tbody>\n";

        for (const rubricScore of grades) {
          body += "<tr>";
          const score = rubricScore.computedScore?.score || 0;
          const pointValue = rubricScore.computedScore?.pointValue || 0;
          const skipStats =
            (rubricScore.computedScore?.unscoredItems || 0) > 20;
          if (!skipStats) {
            scores.push(score);
            percent.push((score / pointValue) * 100);
            unscored.push(rubricScore.computedScore?.unscoredItems || 0);
          }
          body += `<td><a href="${router.url("grade-html", {
            gradeId: rubricScore.id,
          })}">${rubricScore.studentName}</a></td>`;
          body += `<td style="text-align: right">${score}</td>`;
          body += `<td style="text-align: right">${(
            (score / pointValue) *
            100
          ).toFixed(0)}%</td>`;
          body += `<td style="text-align: right">${rubricScore.computedScore?.unscoredItems}</td>`;
          for (const category of rubricScore.categories) {
            body += `<td style="text-align: right">${category.computedScore?.score}`;
            body += ` / ${category.computedScore?.pointValue}`;
            body += ` (${category.computedScore?.unscoredItems})</td>`;
            if (!skipStats) {
              category_scores[category.categoryId].push(
                category.computedScore?.score || 0,
              );
            }
          }
          body += "</tr>\n";
        }

        function trimmedMean(data: number[]): number {
          if (data.length < 2) {
            return Number.NaN;
          }
          const tenP = quantile(data, 0.1);
          const ninetyP = quantile(data, 0.9);
          return _.mean(data.filter((n) => n >= tenP && n <= ninetyP));
        }

        const fixedFmt = (d: number) => (n: number) => n.toFixed(d);
        interface StatsMethods {
          name: string;
          method: (d: number[]) => number;
          format?: (n: number) => string;
        }
        const stats: StatsMethods[] = [
          {
            name: "Count",
            method: (data: number[]) => data.length,
            format: fixedFmt(0),
          },
          { name: "Mean", method: _.mean },
          { name: "Trimmed Mean", method: trimmedMean },
          { name: "StdDev", method: standardDeviation },
          { name: "10%", method: (data: number[]) => quantile(data, 0.1) },
          { name: "Median", method: median },
          { name: "90%", method: (data: number[]) => quantile(data, 0.9) },
        ];

        for (const { name, method, format } of stats) {
          const numFormat = format || fixedFmt(2);
          body += "<tr>";
          body += `<td>${name}</td>`;
          if (scores.length >= 2) {
            body += `<td style="text-align: right">${numFormat(
              method(scores),
            )}</td>\n`;
          } else {
            body += '<td style="text-align: right">N/A</td>\n';
          }
          if (percent.length >= 2) {
            body += `<td style="text-align: right">${numFormat(
              method(percent),
            )}%</td>\n`;
          } else {
            body += '<td style="text-align: right">N/A</td>\n';
          }
          if (unscored.length >= 2) {
            body += `<td style="text-align: right">${numFormat(
              method(unscored),
            )}</td>\n`;
          } else {
            body += '<td style="text-align: right">N/A</td>\n';
          }
          for (const category of rubric.categories) {
            if (category_scores[category.id].length >= 2) {
              body += `<td style="text-align: right">${numFormat(
                method(category_scores[category.id]),
              )}`;
            } else {
              body += '<td style="text-align: right">N/A</td>\n';
            }
          }
          body += "</tr>\n";
        }

        body += "</tbody></table>\n";

        body += "<table><thead><tr>\n";
        body += "<th>Category</th>\n";
        body += "<th>Item</th>\n";
        body += "<th>Point Value</th>\n";
        body += "<th>Average Score</th>\n";
        body += "<th>Min Score</th>\n";
        body += "<th>Max Score</th>\n";
        body += "<th>Distribution</th>\n";
        body += "<th>Total Unscored</th>\n";
        body += "</tr></thead><tbody>\n";
        for (const category of rubric.categories) {
          body += "<tr>";

          body += `<td><b>${category.name}</b></td>\n`;
          body += "<td><b>Category</b></td>\n";

          // figure out point value
          const catScore = scoreCategory(category, makeCategoryScore(category));
          body += `<td><b>${catScore.pointValue}</b></td>\n`;

          const scoreList = grades.map((score) => {
            const catScore = findCategory(score, category.id);
            return catScore?.computedScore?.score || 0;
          });

          body += statsRows(scoreList, scoreList);

          body += "</tr>\n";

          for (const item of category.items) {
            body += "<tr>";

            let decoration = "";
            if (item.scoreValue === "bonus") {
              decoration = ' <span style="color: green">[bonus]</span>';
            } else if (item.scoreValue === "penalty") {
              decoration = ' <span style="color: red">[penalty]</span>';
            }
            body += `<td>${category.name}</td>\n`;
            body += `<td>${item.name}${decoration}</td>\n`;

            let pointValue = item.pointValue;
            if (item.subItems) {
              const tempItemScore = scoreItem(item, makeItemScore(item));
              pointValue = tempItemScore.pointValue;
            }

            body += `<td>${pointValue}</td>\n`;

            const scoreList = grades.map((score) => {
              const itemScore = findInRubric<RubricItemScore>(score, {
                itemId: item.id,
              });
              return itemScore?.computedScore?.score || 0;
            });

            const scoreValueList = grades.map((score) => {
              const itemScore = findInRubric<RubricItemScore>(score, {
                itemId: item.id,
              });
              return itemScore?.score;
            });

            body += statsRows(scoreList, scoreValueList);

            body += "</tr>\n";
          }
        }
        body += "</tbody></table>\n";

        ctx.body = body;
        await next();
      },
    )
    .get(
      "course-rubric-grades",
      "/courses/:courseId/rubrics/:rubricId/grades",
      async (ctx: Context, next: Next) => {
        const { course, rubric } = ctx.state as {
          course: CourseDbObj;
          rubric: Rubric;
        };
        const gradeRefs = course.grades.filter(
          (grade) => grade.rubricId === rubric.id,
        );
        const grades = await Promise.all(
          gradeRefs.map(async (gradeRef) => {
            const rubricScore = await fetchRubricScore(gradeRef.id);
            return rubricScore;
          }),
        );
        ctx.body = grades;
        await next();
      },
    )
    .get(
      "course-student-grade",
      "/courses/:courseId/students/:studentId/grades/:rubricId",
      async (ctx: Context, next: Next) => {
        const { course, student, rubric } = ctx.state as {
          course: CourseDbObj;
          student: Student;
          rubric: Rubric;
        };
        const rubricScore = await getOrAddRubricScore(course, student, rubric);
        ctx.body = rubricScore;
        await next();
      },
    );
}
