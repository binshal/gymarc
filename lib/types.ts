export type Exercise = { id: string; name: string; muscle_group: string | null };

export type SplitDay = {
  id: string;
  split_id: string;
  name: string;
  sort_order: number;
};

export type Split = {
  id: string;
  name: string;
  is_active: boolean;
};

export type DayExercise = {
  id: string;
  split_day_id: string;
  exercise_id: string;
  sort_order: number;
  is_alternate: boolean;
  exercise?: Exercise;
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: "warmup" | "working" | "drop" | "failure";
  rpe: number | null;
  is_pr: boolean;
};

export type GoalType = "bulk" | "cut" | "maintenance";

export type Goal = {
  id: string;
  goal_type: GoalType;
  start_date: string;
  end_date: string;
  target_weight: number | null;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  status: "active" | "completed";
};

export type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  custom_fields: Record<string, number>;
  is_favorite: boolean;
};

export type WeightLog = { id: string; weight: number; logged_at: string };
export type Supplement = { id: string; name: string; dose: string };
export type SupplementLog = { id: string; supplement_id: string; logged_at: string };
export type WaterLog = { id: string; ml: number; logged_at: string; created_at: string };

export type FoodLog = {
  id: string;
  food_id: string | null;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  custom_fields: Record<string, number>;
  logged_at: string;
  created_at: string;
};

export type Comment = {
  id: string;
  session_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { username: string };
};
