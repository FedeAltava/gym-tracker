export interface Exercise {
  name: string;
  series: number;
  reps: string;
  rest: string;
  notes: string;
}

export interface TrainingDay {
  day: string;
  label: string;
  exercises: Exercise[];
}

export interface Person {
  id: string;
  name: string;
  days: TrainingDay[];
}
