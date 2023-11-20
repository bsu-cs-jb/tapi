import {
  Course,
  Rubric,
  RubricScore,
  makeRubricCategory,
  makeRubricItem,
  makeRubricScore,
  makeRubric,
} from 'grading';

export const makeTestRubric = (): Rubric => {
  return makeRubric({
    id: 'test-01',
    name: 'Rubric Test 1',
    categories: [
      makeRubricCategory({
        id: 'test-01',
        name: 'Category 1',
        items: [
          makeRubricItem({
            id: 'test-01-item-01',
            name: 'Item 1',
            pointValue: 10,
            scoreType: 'points',
          }),
          makeRubricItem({
            id: 'test-01-item-02',
            name: 'Item 2',
            pointValue: 4,
            scoreType: 'full_half',
          }),
        ],
      }),
    ],
  });
};

export const makeProject2 = (): Rubric => {
  return makeRubric({
    id: 'project-02',
    name: 'Project 2',
    categories: [

      makeRubricCategory({
        id: 'timer-sets',
        name: 'Timer Sets',
        items: [

          makeRubricItem({
            id: 'timer-sets-001',
            name: 'Can add a timer set with name',
            pointValue: 1,
          }),

          makeRubricItem({
            id: 'timer-sets-002',
            name: 'Can add multiple timer sets',
            pointValue: 2,
          }),

          makeRubricItem({
            id: 'timer-sets-003',
            name: 'Can add one timer to set',
            pointValue: 2,
          }),

          makeRubricItem({
            id: 'timer-sets-004',
            name: 'Can add multiple timers to set',
            pointValue: 2,
            scoreType: 'points',
          }),

          makeRubricItem({
            id: 'timer-sets-005',
            name: 'Timer sets bonus',
            pointValue: 2,
            scoreType: 'points',
            scoreValue: 'bonus',
          }),

          makeRubricItem({
            id: 'timer-sets-006',
            name: 'When adding 10+ timers, scrolling works',
            pointValue: 1,
            scoreType: 'points',
          }),

          makeRubricItem({
            id: 'timer-sets-007',
            name: 'Empty timer name not allowed',
            pointValue: 1,
            scoreType: 'points',
            scoreValue: 'bonus',
          }),

          makeRubricItem({
            id: 'timer-sets-008',
            name: 'Disallows sets with same name or handles properly',
            pointValue: 1,
            scoreType: 'points',
            scoreValue: 'bonus',
          }),

        ],
      }),

      makeRubricCategory({
        id: 'single-timer',
        name: 'Single Timer',
        items: [

          makeRubricItem({
            id: 'single-timer-001',
            name: 'Can create a new timer with name and duration',
            pointValue: 2,
            scoreType: 'full_half',
          }),

          makeRubricItem({
            id: 'single-timer-005',
            name: 'Duration display is HH:MM:SS, MM:SS, or 5m 15s.',
            pointValue: 1,
          }),

          makeRubricItem({
            id: 'single-timer-002',
            name: 'Name cannot be empty',
            pointValue: 1,
            scoreType: 'boolean',
            scoreValue: 'bonus',
          }),

          makeRubricItem({
            id: 'single-timer-003',
            name: 'Duration in range 0 to 59:59',
            pointValue: 1,
            scoreType: 'boolean',
            scoreValue: 'bonus',
          }),

          makeRubricItem({
            id: 'single-timer-004',
            name: 'Duration handles NaNs',
            pointValue: 1,
            scoreType: 'boolean',
            scoreValue: 'bonus',
          }),
        ],
      }),

      makeRubricCategory({
        id: 'edit-timer',
        name: 'Edit Timer',
        items: [

          makeRubricItem({
            id: 'edit-timer-001',
            name: 'Can edit a timer',
            pointValue: 2,
          }),

          makeRubricItem({
            id: 'edit-timer-002',
            name: 'Edit timer problems',
            pointValue: -1,
            scoreValue: 'penalty',
          }),
        ],
      }),

      makeRubricCategory({
        id: 'multiple-timers',
        name: 'Multipler Timers',
        items: [

          makeRubricItem({
            id: 'multiple-timers-001',
            name: 'Can add multiple timers to set',
            pointValue: 4,
            scoreType: 'points',
          }),

          makeRubricItem({
            id: 'multiple-timers-002',
            name: 'Multiple timer problems',
            pointValue: -1,
            scoreValue: 'penalty',
            scoreType: 'points',
          }),
        ],
      }),
    ],
  });
};

export function updateStudentGradebook(
  course: Course,
  studentId: string,
  rubricScore: RubricScore,
) {
  const foundGradebook = course.gradebook.find(
    (gb) => gb.studentId === studentId,
  );
  if (foundGradebook !== undefined) {
    const updatedGradebook = {
      ...foundGradebook,
      assignments: foundGradebook.assignments.map((rs) =>
        rs.id === rubricScore.id ? rubricScore : rs,
      ),
    };
    course.gradebook = course.gradebook.map((sg) =>
      sg.studentId === studentId ? updatedGradebook : sg,
    );
  } else {
    // no gradebook for this student
    const studentGrades = {
      studentId,
      assignments: [rubricScore],
    };
    course.gradebook.push(studentGrades);
    return rubricScore;
  }
}

export function getOrAddRubricScore(
  course: Course,
  studentId: string,
  rubric: Rubric,
): RubricScore {
  const foundGradebook = course.gradebook.find(
    (gb) => gb.studentId === studentId,
  );
  if (foundGradebook !== undefined) {
    const foundScore = foundGradebook.assignments.find(
      (rc) => rc.rubricId === rubric.id,
    );
    if (foundScore !== undefined) {
      return foundScore;
    }
    // found gradebook but no score for this rubric
    const rubricScore = makeRubricScore(rubric);
    foundGradebook.assignments.push(rubricScore);
    return rubricScore;
  } else {
    // no gradebook for this student
    const rubricScore = makeRubricScore(rubric);
    const studentGrades = {
      studentId,
      assignments: [rubricScore],
    };
    course.gradebook.push(studentGrades);
    return rubricScore;
  }
}

export const makeCS411 = (): Course => {
  return {
    id: 'CS411-2023-fall',
    name: 'CS 411 Fall 2023',
    students: [
      {
        id: '8',
        name: 'Leah',
        grades: [],
      },
      {
        id: '5',
        name: 'Brooke',
        grades: [],
      },
      {
        id: '3',
        name: 'Jack',
        grades: [],
      },
    ],
    gradebook: [],
    rubrics: [makeProject2(), makeTestRubric()],
  };
};
