import Router from '@koa/router';
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
  makeRubricScore,
  scoreRubric,
  StudentGradeDbObj,
  CourseGradeDbObj,
  makeStudent,
  updateRubricScore,
  validateRubric,
} from 'grading';

const COURSE:ResourceDef = {
  name: 'courses',
  singular: 'course',
  paramName: 'courseId',
};

const RUBRIC:ResourceDef = {
  name: 'rubrics',
  singular: 'rubric',
  paramName: 'rubricId',
  // parents: [COURSE],
};

const STUDENT:ResourceDef = {
  name: 'students',
  singular: 'student',
  paramName: 'studentId',
  builder: makeStudent,
  // parents: [COURSE],
};

const GRADE:ResourceDef = {
  name: 'grades',
  singular: 'grade',
  paramName: 'gradeId',
  parents: [STUDENT],
};

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
    let body = '<div><p>Grader collections</p><ul>';
    [COURSE, STUDENT, RUBRIC, GRADE].forEach((resource) => {
      body += `<li>${resource.name}: <a href="${router.url(resource.name+'-html')}">html</a> <a href="${router.url(resource.name)}">json</a></li>`;
    });
    body += '</ul></div>';
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
    .get('course-student-grade', '/courses/:courseId/students/:studentId/grades/:rubricId', async (ctx) => {
      const { course, student, rubric } = ctx as unknown as { course: CourseDbObj; student: Student; rubric: Rubric };
      // const existingGrade = student.grades.find((grade: CourseGradeDbObj) => grade.rubricId === rubric.id);
      // log(`Existing student grade for ${course.name} ${student.name} ${rubric.id}`, existingGrade);

      // const rubricScore = await (async () => {
      //   if (existingGrade) {
      //     // TODO: Update / validate score based on rubric
      //     return await readResource<RubricScore>(refWithId(GRADE, existingGrade.id)).then((grade) => {
      //       if (grade) {
      //         log('Updating rubric score');
      //         return updateRubricScore(grade, rubric);
      //       } else {
      //         return undefined;
      //       }
      //     });
      //   } else {
      //     log('Creating new rubric score.');
      //     return getOrAddRubricScore(course, student, rubric);
      //   }
      // })();
      const rubricScore = await getOrAddRubricScore(course, student, rubric);
      ctx.body = rubricScore;
    })
    .put('student-grade', '/students/:studentId/grades/:gradeId', async (ctx) => {
    });

}
