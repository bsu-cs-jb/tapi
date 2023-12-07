import { urlid } from './genid.js';
import { assert } from './utils.js';
import { CourseDbObj } from 'grading';

interface Database {
  courses: CourseDbObj[];
}

const data: Database = {
  courses: [],
};

function initDb() {
  // data.courses = [makeCS411()];
}
initDb();

export function allCourses(): CourseDbObj[] {
  return data.courses;
}

export function getCourse(id: string): CourseDbObj | undefined {
  return data.courses.find((course) => course.id === id);
}

function replaceCourse(newCourse: CourseDbObj): void {
  data.courses = data.courses.map((course) => (course.id === newCourse.id ? newCourse : course));
}

export function updateCourse(updatedCourse: CourseDbObj): CourseDbObj | undefined {
  const course = getCourse(updatedCourse.id);
  if (!course) {
    return;
  }
  const newCourse = {
    ...course,
    ...updatedCourse,
  };
  replaceCourse(newCourse);
  return newCourse;
}

export function insertCourse(course: CourseDbObj): CourseDbObj {
  if (!course.id) {
    course.id = urlid();
  }
  assert(!getCourse(course.id));

  data.courses.push(course);

  return course;
}
