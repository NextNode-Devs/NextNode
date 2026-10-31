/** Mirrors the #2 portfolio and directory responses (`/api/developers/…`).
 * Links are shown as the developer entered them; nothing here is "verified". */

export type Skill = { key: string; label: string };

export type ProjectLink = { title: string; repository_url: string; demo_url: string | null };

/** `GET /api/developers/{id}/` and `/api/developers/me/portfolio/`. */
export type Portfolio = {
  account_id: number;
  display_name: string;
  headline: string;
  bio: string;
  github_username: string | null;
  github_url: string | null;
  skills: Skill[];
  projects: ProjectLink[];
  resume_url: string | null;
  is_available: boolean;
  /** Drives the edit controls only; the API enforces ownership itself. */
  is_owner: boolean;
};

/** One result in `GET /api/developers/`. */
export type DeveloperCard = {
  account_id: number;
  display_name: string;
  headline: string;
  skills: Skill[];
  is_available: boolean;
  project_count: number;
};

export type DirectoryPage = {
  results: DeveloperCard[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

/** The backend's limits (`nextnode.domain.accounts`), mirrored so the form
 * catches mistakes before saving. The backend stays the authority. */
export const PORTFOLIO_LIMITS = {
  headline: 120,
  bio: 2000,
  projectTitle: 80,
  url: 200,
  projects: 6,
  search: 100,
  skillFilters: 10,
} as const;
