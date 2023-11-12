import { urlid, withId } from "./genid.js";
import { assert } from "./utils.js";
import { makeCS411 } from "./CourseDef.js"
import { Course, Rubric, RubricScore } from "grading";

interface Database {
  courses: Course[];
}

const data: Database = {
  courses: [],
};

function initDb() {
  data.courses = [makeCS411()];
}
initDb();

export function allCourses(): Course[] {
  return data.courses;
}

export function getCourse(id: string): Course | undefined {
  return data.courses.find((course) => course.id === id);
}

function replaceCourse(newCourse: Course): void {
  data.courses = data.courses.map((course) => (course.id === newCourse.id ? newCourse : course));
}

export function updateCourse(updatedCourse: Course): Course | undefined {
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

export function insertCourse(course: Course): Course {
  if (!course.id) {
    course.id = urlid();
  }
  assert(!getCourse(course.id));

  data.courses.push(course);

  return course;
}
