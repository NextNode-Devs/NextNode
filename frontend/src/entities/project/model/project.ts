/** Mirrors the #3 project responses (`/api/projects/…`). Developer ideas carry
 * no `proposed_budget_cents` key at all: they never have a budget. */

export type ProjectKind = "client" | "developer";

export type ProjectStatus = "Posted" | "OfferSent" | "Assigned" | "InProgress" | "Completed" | "Archived";

export type Skill = { key: string; label: string };

export type Person = { account_id: number; display_name: string };

/** One result in `GET /api/projects/` and `GET /api/projects/mine/`. */
export type ProjectCard = {
  id: number;
  kind: ProjectKind;
  status: ProjectStatus;
  title: string;
  tech_stack: Skill[];
  target_delivery_date: string;
  /** Client projects only: a proposal the client and Team Lead may negotiate (#6). */
  proposed_budget_cents?: number;
  owner: Person;
  lead: Person | null;
  needs_lead: boolean;
  open_spots: number;
  created_at: string | null;
};

/** The single primary action the detail page shows (#4 renders lead, #5 renders join). */
export type ViewerAction = "apply_to_lead" | "apply_to_join";

/** `GET /api/projects/{id}/`. `viewer` drives the controls; the API re-checks every action. */
export type Project = Omit<ProjectCard, "needs_lead" | "open_spots"> & {
  description: string;
  team: { id: number; status: string; size: number | null; headcount: number; open_spots: number };
  viewer: {
    is_owner: boolean;
    is_lead: boolean;
    is_member: boolean;
    can_edit: boolean;
    can_upload_documents: boolean;
    can_read_documents: boolean;
  };
  viewer_actions: ViewerAction[];
};

export type MyProject = { project: ProjectCard; my_role: "owner" | "lead" | "member" };

export type ProjectPage = {
  results: ProjectCard[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

/** `GET /api/projects/{id}/documents/`. */
export type RequirementDocument = {
  id: string;
  filename: string;
  type: "pdf" | "docx";
  size_bytes: number;
  uploaded_at: string | null;
};

/** The backend's limits (`nextnode.domain.projects`), mirrored so forms catch
 * mistakes before saving. The backend stays the authority. */
export const PROJECT_LIMITS = {
  titleMin: 5,
  title: 100,
  descriptionMin: 20,
  description: 5000,
  techStack: 20,
  techFilters: 10,
  minBudgetCents: 150_000,
  maxBudgetCents: 100_000_000,
  documentBytes: 10 * 1024 * 1024,
  documents: 10,
} as const;

export const KIND_LABEL: Record<ProjectKind, string> = {
  client: "Client project",
  developer: "Developer idea",
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  Posted: "Posted",
  OfferSent: "Offer sent",
  Assigned: "Assigned",
  InProgress: "In progress",
  Completed: "Completed",
  Archived: "Archived",
};

export const projectHref = (id: number) => `/projects/${id}`;
