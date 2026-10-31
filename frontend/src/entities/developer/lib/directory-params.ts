import { PORTFOLIO_LIMITS } from "../model/developer";

/** The directory's view, as it lives in the URL (`/developers?q=&skills=&available=&page=`). */
export type DirectoryFilters = {
  q: string;
  /** Display spellings; compared case-insensitively, like the backend. */
  skills: string[];
  available: boolean;
  page: number;
};

export const NO_FILTERS: DirectoryFilters = { q: "", skills: [], available: false, page: 1 };

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function first(params: Params, name: string): string {
  if (params instanceof URLSearchParams) return params.get(name) ?? "";
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const squash = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
const keyOf = (skill: string) => squash(skill).toLocaleLowerCase("en");

/** One spelling per skill, in a stable order, so equal filters give equal URLs. */
export function normalizeSkills(skills: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of skills) {
    const label = squash(raw);
    if (label && !byKey.has(keyOf(label))) byKey.set(keyOf(label), label);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, PORTFOLIO_LIMITS.skillFilters)
    .map(([, label]) => label);
}

/** Reads the URL. Anything malformed falls back to the default rather than erroring. */
export function parseDirectoryParams(params: Params): DirectoryFilters {
  const page = Number(first(params, "page"));
  return {
    q: squash(first(params, "q")).slice(0, PORTFOLIO_LIMITS.search),
    skills: normalizeSkills(first(params, "skills").split(",")),
    available: first(params, "available") === "true",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The query string for some filters, defaults left out: `""` or `?q=…`. */
export function directoryQuery(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  const q = squash(filters.q);
  const skills = normalizeSkills(filters.skills);
  if (q) params.set("q", q);
  if (skills.length) params.set("skills", skills.join(","));
  if (filters.available) params.set("available", "true");
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasFilters(filters: DirectoryFilters): boolean {
  return Boolean(squash(filters.q) || filters.skills.length || filters.available);
}
