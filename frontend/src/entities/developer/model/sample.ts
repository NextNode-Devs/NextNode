/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #102). Only prototype screens may import
 * this; never a Phase 1 screen.
 *
 * `sampleProfileGrowth(accountId)` gives any REAL developer (for example a
 * card from the live directory) stable sample values for the planned fields,
 * so prototype filters and badges have something to work with. The same id
 * always gives the same values, so server and browser renders match.
 */
import type { DeveloperCard, Skill } from "./developer";
import { TIME_ZONE_OPTIONS, type ProfileGrowth } from "./profile-growth";
import type { ShippedProject } from "./shipped-project";

export function sampleProfileGrowth(accountId: number): ProfileGrowth {
  const zones = TIME_ZONE_OPTIONS;
  return {
    account_id: accountId,
    // Every 7th developer has not set a time zone yet, so filters show the "Not set" case.
    time_zone: accountId % 7 === 0 ? null : zones[accountId % zones.length].value,
    is_new_talent: accountId % 3 === 0,
    certificates:
      accountId % 2 === 0
        ? [
            {
              id: accountId * 10 + 1,
              title: "AWS Certified Cloud Practitioner",
              issuer: "Amazon Web Services",
              issued_on: "2026-06-14",
              file_name: "aws-cloud-practitioner.pdf",
            },
          ]
        : [],
  };
}

const skills = (...labels: string[]): Skill[] => labels.map((label) => ({ key: label.toLowerCase(), label }));

/**
 * Sample developers for the Hire Devs prototype (#91), typed to the directory
 * card the planned matches response will carry. They are not real accounts:
 * their ids (9001+) have no portfolio, so screens never link to one. Pair each
 * with `sampleProfileGrowth(account_id)` for the time zone only: new talent is
 * the card's own `is_new_talent`, as the API works it out (joined within
 * `NEW_TALENT_DAYS`). The flags are fixed as of 22 Nov 2026, matching `joined_at`.
 */
export const SAMPLE_HIRE_DEVS_POOL: readonly DeveloperCard[] = [
  { account_id: 9001, display_name: "Amara Okafor", headline: "Full-stack developer, React and Django", skills: skills("React", "TypeScript", "Django", "Python", "PostgreSQL"), is_available: true, project_count: 6, joined_at: "2026-03-02T15:00:00Z", is_new_talent: false },
  { account_id: 9002, display_name: "Liam Tremblay", headline: "Frontend developer who cares about accessibility", skills: skills("React", "TypeScript", "Next.js", "Tailwind CSS"), is_available: true, project_count: 4, joined_at: "2026-05-19T15:00:00Z", is_new_talent: false },
  { account_id: 9003, display_name: "Priya Raman", headline: "Recent graduate, Python and data", skills: skills("Python", "Django", "PostgreSQL"), is_available: true, project_count: 1, joined_at: "2026-11-14T15:00:00Z", is_new_talent: true },
  { account_id: 9004, display_name: "Mateo Santos", headline: "Backend and DevOps", skills: skills("Python", "Django", "Docker", "AWS", "PostgreSQL"), is_available: false, project_count: 8, joined_at: "2025-12-08T15:00:00Z", is_new_talent: false },
  { account_id: 9005, display_name: "Hana Kim", headline: "Mobile and web, React Native", skills: skills("React", "React Native", "TypeScript", "Firebase"), is_available: true, project_count: 3, joined_at: "2026-07-21T15:00:00Z", is_new_talent: false },
  { account_id: 9006, display_name: "Noah Fischer", headline: "Node.js APIs and real-time apps", skills: skills("Node.js", "TypeScript", "PostgreSQL", "Docker"), is_available: true, project_count: 5, joined_at: "2026-04-11T15:00:00Z", is_new_talent: false },
  { account_id: 9007, display_name: "Zainab Yusuf", headline: "UI designer learning frontend", skills: skills("Figma", "Tailwind CSS", "React"), is_available: true, project_count: 0, joined_at: "2026-11-18T15:00:00Z", is_new_talent: true },
  { account_id: 9008, display_name: "Ethan Clarke", headline: "Java and Spring developer", skills: skills("Java", "Spring Boot", "PostgreSQL"), is_available: false, project_count: 7, joined_at: "2026-01-27T15:00:00Z", is_new_talent: false },
  { account_id: 9009, display_name: "Sofia Rossi", headline: "Next.js and TypeScript, first projects", skills: skills("Next.js", "TypeScript", "React", "Docker"), is_available: true, project_count: 1, joined_at: "2026-11-10T15:00:00Z", is_new_talent: true },
  { account_id: 9010, display_name: "Arjun Mehta", headline: "Cloud and infrastructure", skills: skills("AWS", "Docker", "Terraform", "Python"), is_available: true, project_count: 4, joined_at: "2026-06-30T15:00:00Z", is_new_talent: false },
];

/* ---------- Shipped projects (NN-17 #97) ---------- */

const SHIPPED: ShippedProject[] = [
  {
    project_id: 9101,
    title: "Clinic booking app",
    summary: "Online booking, reminders and payments for a family clinic.",
    role: "lead",
    tech_stack: skills("Next.js", "Django", "PostgreSQL"),
    shipped_at: "2027-01-22T16:30:00Z",
    confidential: false,
  },
  {
    project_id: 9102,
    title: "Food bank tracker",
    summary: "Stock and volunteer shifts for a neighbourhood food bank.",
    role: "member",
    tech_stack: skills("React", "Node.js"),
    shipped_at: "2026-10-03T18:00:00Z",
    confidential: false,
  },
  {
    project_id: 9103,
    title: "Internal payroll dashboard",
    summary: "A confidential client project.",
    role: "member",
    tech_stack: skills("TypeScript"),
    shipped_at: "2026-08-15T18:00:00Z",
    confidential: true,
  },
];

/**
 * Stable sample shipped projects for any real developer: every third
 * developer has none yet (the empty state); the rest have two public ones
 * and one confidential one, which their portfolio never lists.
 */
export function sampleShippedProjects(accountId: number): ShippedProject[] {
  if (accountId % 3 === 0) return [];
  return SHIPPED.map((p) => ({ ...p, role: accountId % 2 === 0 && p.role === "lead" ? "member" : p.role }));
}
