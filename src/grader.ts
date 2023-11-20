import Router from '@koa/router';
import { jsonhtml } from './utils.js';
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
    console.log(`Found grade for ${student.name} ${rubric.name}`, foundGrade);
    return await readResource<RubricScore>(refWithId(GRADE, foundGrade.id));
  } else {
    // no grade for this rubric for this student
    const rubricScore = makeRubricScore(rubric);
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

export function graderRoutes(router: Router) {

  router.get('/', async (ctx) => {
    ctx.body = `<p>Nice to meet you, are you looking for my <a href="${router.url('courses')}">Courses</a>?</p>`;
  });

  routerParam(router, COURSE);
  routerParam(router, RUBRIC);
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
    .get('students', '/courses/:courseId/students', async (ctx) => {
      const { course, params: { courseId } } = ctx;
      let body = `<p>Course id: ${courseId}</p>`;
      body += `<p>Course: <a href="${router.url('course-html', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += linkList(router, STUDENT, course.students, { courseId });
      body += jsonhtml(course.students);
      ctx.body = body;
    })
    .get('student', '/courses/:courseId/students/:studentId', async (ctx) => {
      const { course, student } = ctx;
      let body = '';
      body += `<p>Course: <a href="${router.url('course-html', { courseId: course.id })}">${course.name}</a></p>\n`;
      body += `<p>Student: <a href="${router.url('student-html', { courseId: course.id, studentId: student.id })}">${student.name}</a></p>\n`;
      body += jsonhtml(student);
      ctx.body = body;
      return ctx;
    })
    .get('student-grade', '/courses/:courseId/students/:studentId/grades/:rubricId', async (ctx) => {
      const { course, student, rubric } = ctx as unknown as { course: CourseDbObj; student: Student; rubric: Rubric };
      const existingGrade = student.grades.find((grade) => grade.rubricId === rubric.id);
      console.log(`Existing student grade for ${course.name} ${student.name} ${rubric.id}`, existingGrade);

      const rubricScore = await (async () => {
        if (existingGrade) {
          return await readResource<RubricScore>(refWithId(GRADE, existingGrade.id));
        } else {
          console.log('Creating new rubric score.');
          return getOrAddRubricScore(course, student, rubric);
        }
      })();
      ctx.body = rubricScore;
    })
    .put('student-grade', '/students/:studentId/grades/:gradeId', async (ctx) => {
    });

}
