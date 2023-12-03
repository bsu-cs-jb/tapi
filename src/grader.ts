import Router from '@koa/router';
import * as _ from 'lodash-es';

import { jsonhtml, log } from './utils.js';
import {
  ResourceDef,
  readResource,
  writeResource,
  refWithId,
} from './FileDb.js';
import {
  routerParam,
  linkList,
  getCollection,
  getResource,
  putResource,
  postResource,
} from './RestAPI.js';
import {
  CourseDbObj,
  Student,
  Rubric,
  RubricScore,
  RubricItemScore,
  makeRubricScore,
  scoreRubric,
  StudentGradeDbObj,
  CourseGradeDbObj,
  makeStudent,
  updateRubricScore,
  validateRubric,
  findCategory,
  findInRubric,
  scoreCategory,
  makeCategoryScore,
} from 'grading';

const COURSE:ResourceDef = {
  name: 'courses',
  singular: 'course',
  paramName: 'courseId',
  sortBy: 'name',
};

const RUBRIC:ResourceDef = {
  name: 'rubrics',
  singular: 'rubric',
  paramName: 'rubricId',
  // parents: [COURSE],
  sortBy: 'name',
};

const STUDENT:ResourceDef = {
  name: 'students',
  singular: 'student',
  paramName: 'studentId',
  builder: makeStudent,
  // parents: [COURSE],
  sortBy: 'name',
};

const GRADE:ResourceDef = {
  name: 'grades',
  singular: 'grade',
  paramName: 'gradeId',
  parents: [STUDENT],
  sortBy: 'name',
};

async function fetchStudent(id:string): Promise<Student|undefined> {
  return readResource<Student>(refWithId(STUDENT, id));
}

async function fetchRubricScore(id:string): Promise<RubricScore|undefined> {
  return readResource<RubricScore>(refWithId(GRADE, id));
}

async function fetchGrades(course: CourseDbObj, rubric: Rubric, skipTestStudents = true): Promise<RubricScore[]> {
  const cachedFetchStudent = _.memoize(fetchStudent);

  const gradeRefs = course.grades.filter((grade) => grade.rubricId === rubric.id);
  const grades = await Promise.all((await Promise.all(
    gradeRefs
      .map(async (gradeRef) => {
        if (skipTestStudents) {
          const student = await cachedFetchStudent(gradeRef.studentId);
          if (student?.test) {
            return undefined;
          }
        }
        const rubricScore = await fetchRubricScore(gradeRef.id);
        return rubricScore;
      })))
    .filter((s):s is RubricScore => s !== undefined)
    .map(async (s) => {
      const updated = updateRubricScore(s, rubric);
      // TODO: this isEqual does not work
      // if (!isEqual(s, updated)) {
      // Old-school solution works fine
      if (JSON.stringify(s) !== JSON.stringify(updated)) {
        log(`Needs updated: ${s.name}`);
        await writeResource(refWithId(GRADE, updated.id), updated);
      }
      return updated;
    }));
  return _.sortBy(grades, 'studentName');
}

// function courseRef(courseId: string):ResourceDef {
//   const ref = cloneDeep(COURSE);
//   ref.id = courseId;
//   return ref;
// }
//
// function rubricRef(courseId: string, rubricId:string):ResourceDef {
//   const ref = cloneDeep(RUBRIC);
//   ref.id = rubricId;
//   ref.parents = [courseRef(courseId)];
//   return ref;
// }
//
// function studentRef(courseId: string, studentId: string):ResourceDef {
//   const ref = cloneDeep(STUDENT);
//   ref.id = studentId;
//   ref.parents = [courseRef(courseId)];
//   return ref;
// }

export async function getOrAddRubricScore(
  course: CourseDbObj,
  student: Student,
  rubric: Rubric,
): Promise<RubricScore|undefined> {
  const foundGrade = course.grades.find(
    (g) => g.studentId === student.id && g.rubricId === rubric.id,
  );
  if (foundGrade) {
    // look this up and return it
    log(`Found grade for ${course.name} ${student.name} ${rubric.name}`, foundGrade);
    const rubricScore = await readResource<RubricScore>(refWithId(GRADE, foundGrade.id));
    // Update this since it wasn't originally saved
    if (rubricScore) {
      rubricScore.studentId = student.id;
      rubricScore.studentName = student.name;
      rubricScore.courseId = course.id;
      rubricScore.courseName = course.name;
      rubricScore.name = `${rubric.name} for ${student.name} in ${course.name}`;
      log('Updating rubric score');
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

function processRubric(rubric: Rubric): Rubric|undefined {
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

  router.get('/', async (ctx) => {
    let body = '<div><p>Grader collections</p><ul>\n';
    [COURSE, STUDENT, RUBRIC, GRADE].forEach((resource) => {
      body += `<li>${resource.name}: <a href="${router.url(resource.name+'-html')}">html</a> <a href="${router.url(resource.name)}">json</a></li>\n`;
    });
    body += '</ul></div>\n';
    body += '<div><p>Other links</p><ul>\n';
    body += '<li><a href="http://localhost:3000/grader/courses/CS411-2023-fall/rubrics/project-02/grades.html">Project 2 Grade stats</a></li>\n';
    body += '</ul></div>\n';
    ctx.body = body;
  });

  routerParam(router, COURSE);
  routerParam(router, RUBRIC, processRubric);
  routerParam(router, STUDENT);
  routerParam(router, GRADE);

  getCollection(router, COURSE);
  getResource(router, COURSE, [RUBRIC, STUDENT, GRADE]);
  postResource(router, COURSE);
  putResource(router, COURSE);

  getCollection(router, STUDENT);
  getResource(router, STUDENT, [GRADE]);
  postResource(router, STUDENT);
  putResource(router, STUDENT);

  [RUBRIC, GRADE].forEach((resource) => {
    getCollection(router, resource);
    getResource(router, resource);
    postResource(router, resource);
    putResource(router, resource);
  });

  router
    .get('course-students', '/courses/:courseId/students', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course: <a href="${router.url('course-html', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += linkList(router, STUDENT, course.students, { courseId });
      body += jsonhtml(course.students);
      ctx.body = body;
    })
    .get('course-student', '/courses/:courseId/students/:studentId', async (ctx) => {
      const { course, student } = ctx;
      let body = '';
      body += `<p>Course: <a href="${router.url('course-html', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += `<p>Student: <a href="${router.url('student-html', { courseId: course.id, studentId: student.id })}">${student.name}</a></p>\n`;
      body += jsonhtml(student);
      ctx.body = body;
      return ctx;
    })
    .get('course-rubric-grades-html', '/courses/:courseId/rubrics/:rubricId/grades.html', async (ctx) => {
      const { course, rubric } = ctx as unknown as { course: CourseDbObj; rubric: Rubric };
      let body = '';
      body += `<p>Course: <a href="${router.url('course-html', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += `<p>Rubric: <a href="${router.url('rubric-html', { rubricId: rubric.id })}">${rubric.name}</a></p>\n`;

      const grades = await fetchGrades(course, rubric);

      function statsRows(scoreList: number[], scoreValueList: (number|undefined)[]): string {
        let rows = '';
        rows += `<td>${_.mean(scoreList).toFixed(2)}</td>\n`;
        rows += `<td>${_.min(scoreList)}</td>\n`;
        rows += `<td>${_.max(scoreList)}</td>\n`;

        const distr = Object.entries(_.countBy(scoreList));
        const sortedDistr = _.sortBy(distr, [(i:[string,number]) => Number.parseFloat(i[0])]);
        let distrValue = `${sortedDistr.length} values`;
        if (sortedDistr.length <= 3) {
          distrValue = _.join(sortedDistr.map(([k,c]) => `${k}: ${c}`), '; ');
        }

        rows += `<td>${distrValue}</td>\n`;
        rows += `<td>${scoreValueList.filter((s) => s === undefined).length}</td>\n`;
        return rows;
      }


      body += '<table><thead><tr>\n';
      body += '<th>Student</th>\n';
      body += '<th>Score</th>\n';
      body += '<th>Point Value</th>\n';
      body += '<th>Percent</th>\n';
      body += '<th>Unscored</th>\n';
      body += '</tr></thead><tbody>\n';
      for (const rubricScore of grades) {
        const score = rubricScore.computedScore?.score || 0;
        const pointValue = rubricScore.computedScore?.pointValue || 0;
        body += '<tr>';
        body += `<td><a href="${router.url('grade-html', { gradeId: rubricScore.id })}">${rubricScore.studentName}</a></td>`;
        body += `<td style="text-align: right">${rubricScore.computedScore?.score}</td>`;
        body += `<td style="text-align: right">${rubricScore.computedScore?.pointValue}</td>`;
        body += `<td style="text-align: right">${(score/pointValue*100).toFixed(0)}%</td>`;
        body += `<td style="text-align: right">${rubricScore.computedScore?.unscoredItems}</td>`;
        body += '</tr>\n';
      }
      body += '</tbody></table>\n';

      body += '<table><thead><tr>\n';
      body += '<th>Student</th>\n';
      body += '<th>Score</th>\n';
      body += '<th>Percent</th>\n';
      body += '<th>Unscored</th>\n';
      for (const category of rubric.categories) {
        body += `<th>${category.name}</th>\n`;
      }
      body += '</tr></thead><tbody>\n';
      for (const rubricScore of grades) {
        body += '<tr>';
        const score = rubricScore.computedScore?.score || 0;
        const pointValue = rubricScore.computedScore?.pointValue || 0;
        body += `<td><a href="${router.url('grade-html', { gradeId: rubricScore.id })}">${rubricScore.studentName}</a></td>`;
        body += `<td style="text-align: right">${rubricScore.computedScore?.score}</td>`;
        body += `<td style="text-align: right">${(score/pointValue*100).toFixed(0)}%</td>`;
        body += `<td style="text-align: right">${rubricScore.computedScore?.unscoredItems}</td>`;
        for (const category of rubricScore.categories) {
          body += `<td style="text-align: right">${category.computedScore?.score}`;
          body += ` / ${category.computedScore?.pointValue}`;
          body += ` (${category.computedScore?.unscoredItems})</td>`;
        }
        body += '</tr>\n';
      }
      body += '</tbody></table>\n';

      body += '<table><thead><tr>\n';
      body += '<th>Category</th>\n';
      body += '<th>Item</th>\n';
      body += '<th>Point Value</th>\n';
      body += '<th>Average Score</th>\n';
      body += '<th>Min Score</th>\n';
      body += '<th>Max Score</th>\n';
      body += '<th>Distribution</th>\n';
      body += '<th>Total Unscored</th>\n';
      body += '</tr></thead><tbody>\n';
      for (const category of rubric.categories) {
        body += '<tr>';

        body += `<td><b>${category.name}</b></td>\n`;
        body += '<td><b>Category</b></td>\n';

        // figure out point value
        const catScore = scoreCategory(category, makeCategoryScore(category));
        body += `<td><b>${catScore.pointValue}</b></td>\n`;

        const scoreList = grades.map((score) => {
          const catScore = findCategory(score, category.id);
          return catScore?.computedScore?.score || 0;
        });

        body += statsRows(scoreList, scoreList);

        body += '</tr>\n';

        for (const item of category.items) {
          body += '<tr>';

          let decoration = '';
          if (item.scoreValue === 'bonus') {
            decoration = ' <span style="color: green">[bonus]</span>';
          } else if (item.scoreValue === 'penalty') {
            decoration = ' <span style="color: red">[penalty]</span>';
          }
          body += `<td>${category.name}</td>\n`;
          body += `<td>${item.name}${decoration}</td>\n`;
          body += `<td>${item.pointValue}</td>\n`;

          const scoreList = grades.map((score) => {
            const itemScore = findInRubric<RubricItemScore>(score, { itemId: item.id });
            return itemScore?.computedScore?.score || 0;
          });

          const scoreValueList = grades.map((score) => {
            const itemScore = findInRubric<RubricItemScore>(score, { itemId: item.id });
            return itemScore?.score;
          });

          body += statsRows(scoreList, scoreValueList);

          body += '</tr>\n';
        }
      }
      body += '</tbody></table>\n';

      ctx.body = body;
    })
    .get('course-rubric-grades', '/courses/:courseId/rubrics/:rubricId/grades', async (ctx) => {
      const { course, rubric } = ctx as unknown as { course: CourseDbObj; rubric: Rubric };
      const gradeRefs = course.grades.filter((grade) => grade.rubricId === rubric.id);
      const grades = await Promise.all(gradeRefs.map(async (gradeRef) => {
        const rubricScore = await fetchRubricScore(gradeRef.id);
        return rubricScore;
      }));
      ctx.body = grades;
    })
    .get('course-student-grade', '/courses/:courseId/students/:studentId/grades/:rubricId', async (ctx) => {
      const { course, student, rubric } = ctx as unknown as { course: CourseDbObj; student: Student; rubric: Rubric };
      const rubricScore = await getOrAddRubricScore(course, student, rubric);
      ctx.body = rubricScore;
    })
    .put('student-grade', '/students/:studentId/grades/:gradeId', async (ctx) => {
    });

}
