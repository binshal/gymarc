import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal, FoodLog } from "./types";

export async function getActiveGoal(supabase: SupabaseClient, userId: string): Promise<Goal | null> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Goal | null;
}

export async function getTodayFoodLogs(supabase: SupabaseClient, userId: string): Promise<FoodLog[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("logged_at", today)
    .order("created_at", { ascending: false });
  return (data as FoodLog[]) ?? [];
}

export function sumMacros(logs: FoodLog[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + Number(l.protein),
      carbs: acc.carbs + Number(l.carbs),
      fat: acc.fat + Number(l.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function daysLeft(goal: Goal) {
  const end = new Date(goal.end_date);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - now.getTime()) / 86400000));
}

export const GOAL_LABEL: Record<Goal["goal_type"], string> = {
  bulk: "Bulk",
  cut: "Cut",
  maintenance: "Maintenance",
};
