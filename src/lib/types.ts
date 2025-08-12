export type Category = {
  id: string;
  name: string;
};

export type ExerciseItem = {
  id: string;
  name: string;
  categoryId: string;
  defaultSets: number;
};

export type ExercisesState = {
  [exerciseId: string]: {
    checkedSets: boolean[];
    memo: string;
  };
};

export type InputMode = 'checkbox' | 'text';

export type DayRecord = {
  date: string; // YYYY-MM-DD 形式の日付
  exercises: ExercisesState;
};
