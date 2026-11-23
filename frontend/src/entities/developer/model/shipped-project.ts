import type { Skill } from "./developer";

/**
 * "Shipped projects" on a developer's portfolio (Phase 2 prototype, NN-17
 * #97). A portfolio entry is written for every team member when a client
 * gives final approval and the project is archived.
 *
 * PROTOTYPE: planned `GET /api/developers/{id}/shipped-projects/`. The real
 * API never returns confidential projects to anyone; the sample keeps the
 * flag so the screen can show the rule (NN-41 adds `confidential` to Project).
 */
export type ShippedProject = {
  project_id: number;
  title: string;
  summary: string;
  role: "lead" | "member";
  tech_stack: Skill[];
  /** When the project was archived after final approval. */
  shipped_at: string;
  /** SAMPLE FLAG until NN-41: confidential projects are never listed. */
  confidential: boolean;
};

export const SHIPPED_ROLE_LABEL: Record<ShippedProject["role"], string> = {
  lead: "Team Lead",
  member: "Developer",
};

/** What a portfolio lists: never a confidential project, newest first. */
export function listedShippedProjects(projects: readonly ShippedProject[]): ShippedProject[] {
  return projects.filter((p) => !p.confidential).sort((a, b) => b.shipped_at.localeCompare(a.shipped_at));
}

/** How many of a developer's own shipped projects are kept off their portfolio. */
export function hiddenConfidentialCount(projects: readonly ShippedProject[]): number {
  return projects.filter((p) => p.confidential).length;
}
