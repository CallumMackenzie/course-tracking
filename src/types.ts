export type DeliverableType =
  | "assignment"
  | "quiz"
  | "test"
  | "final"
  | "participation";

export type Deliverable = {
  id: number;
  type: DeliverableType;
  name: string;
  date: string | null;
  start_date: string | null;
  due_date: string | null;
  sort_date: string | null;
  points: number | null;
  grading_group: string | null;
  grading_group_worth_pct: number | null;
  worth_pct_estimated: boolean;
  course_code: string;
  worth_pct: number;
  completed: boolean;
};
