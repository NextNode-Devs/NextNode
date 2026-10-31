import { PROJECT_LIMITS, type ProjectKind } from "../model/project";

/** The search's view, as it lives in the URL (`/projects?kind=&tech=&needs_lead=&open_spots=&page=`). */
export type ProjectFilters = {
  kind: ProjectKind | null;
  /** Display spellings; compared case-insensitively, like the backend. */
  tech: string[];
  needsLead: boolean;
  openSpots: boolean;
  page: number;
};

export const NO_PROJECT_FILTERS: ProjectFilters = {
  kind: null,
  tech: [],
  needsLead: false,
  openSpots: false,
  page: 1,
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function first(params: Params, name: string): string {
  if (params instanceof URLSearchParams) return params.get(name) ?? "";
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const squash = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
const keyOf = (tech: string) => squash(tech).toLocaleLowerCase("en");

/** One spelling per technology, in a stable order, so equal filters give equal URLs. */
export function normalizeTech(tech: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of tech) {
    const label = squash(raw);
    if (label && !byKey.has(keyOf(label))) byKey.set(keyOf(label), label);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, PROJECT_LIMITS.techFilters)
    .map(([, label]) => label);
}

/** Reads the URL. Anything malformed falls back to the default rather than erroring. */
export function parseProjectParams(params: Params): ProjectFilters {
  const kind = first(params, "kind");
  const page = Number(first(params, "page"));
  return {
    kind: kind === "client" || kind === "developer" ? kind : null,
    tech: normalizeTech(first(params, "tech").split(",")),
    needsLead: first(params, "needs_lead") === "true",
    openSpots: first(params, "open_spots") === "true",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The query string for some filters, defaults left out: `""` or `?kind=…`. */
export function projectQuery(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  const tech = normalizeTech(filters.tech);
  if (filters.kind) params.set("kind", filters.kind);
  if (tech.length) params.set("tech", tech.join(","));
  if (filters.needsLead) params.set("needs_lead", "true");
  if (filters.openSpots) params.set("open_spots", "true");
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasProjectFilters(filters: ProjectFilters): boolean {
  return Boolean(filters.kind || filters.tech.length || filters.needsLead || filters.openSpots);
}
