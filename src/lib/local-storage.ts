"use client";

import { DayRecord, ExercisesState } from "./types";

const EXERCISES_KEY = "exercises:v1";
const RECORD_KEY_PREFIX = "records:v1:";

export function loadExercises(): ExercisesState | null {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY);
    return raw ? (JSON.parse(raw) as ExercisesState) : null;
  } catch {
    return null;
  }
}

export function saveExercises(state: ExercisesState) {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(state));
}

export function loadDayRecord(date: string): DayRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY_PREFIX + date);
    return raw ? (JSON.parse(raw) as DayRecord) : null;
  } catch {
    return null;
  }
}

export function saveDayRecord(rec: DayRecord) {
  localStorage.setItem(RECORD_KEY_PREFIX + rec.date, JSON.stringify(rec));
}
