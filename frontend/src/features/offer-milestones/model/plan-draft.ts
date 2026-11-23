import { MILESTONE_RULES, milestoneScheduleProblems, type MilestoneDraftRow } from "@/entities/milestone";
import { parseBudget } from "@/entities/project";

export const MAX_MILESTONES = 10;

export type ParsedRow = { sequence: number; title: string; amount_cents: number; due_date: string };

/** The rows as milestones; an amount that can't be read counts as 0 (and is reported below). */
export function parseRows(rows: readonly MilestoneDraftRow[]): ParsedRow[] {
  return rows.map((row, index) => ({
    sequence: index + 1,
    title: row.title.trim(),
    amount_cents: parseBudget(row.amount) ?? 0,
    due_date: row.due_date,
  }));
}

/**
 * Everything stopping the plan from going out with the offer, in plain words.
 * The schedule rules are the shared ones the backend will enforce too.
 */
export function planProblems(rows: readonly MilestoneDraftRow[], offerTotalCents: number): string[] {
  const problems: string[] = [];
  rows.forEach((row, index) => {
    if (row.amount.trim() && parseBudget(row.amount) === null) {
      problems.push(`Milestone ${index + 1}: enter the amount as a number, e.g. 1500 or 1500.50.`);
    }
    if (!row.due_date) problems.push(`Milestone ${index + 1} needs a due date.`);
    if (row.title.trim().length > MILESTONE_RULES.titleMax) {
      problems.push(`Milestone ${index + 1}: keep the title under ${MILESTONE_RULES.titleMax} characters.`);
    }
  });
  return [...problems, ...milestoneScheduleProblems(parseRows(rows), offerTotalCents)];
}
