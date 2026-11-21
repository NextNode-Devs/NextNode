import { PORTFOLIO_LIMITS } from "../model/developer";
import { TIME_ZONE_OPTIONS, type ProfileGrowth } from "../model/profile-growth";

/**
 * The directory's view, as it lives in the URL
 * (`/developers?q=&skills=&available=&tz=&new_talent=&page=`).
 *
 * `time_zone` and `new_talent` are PLANNED filters (Phase 2, #93): the API
 * can't filter on them yet, so they stay in the URL and narrow the loaded page
 * in the browser (`matchesPlannedFilters`). `apiDirectoryQuery` leaves them
 * out of the request.
 */
export type DirectoryFilters = {
  q: string;
  /** Display spellings; compared case-insensitively, like the backend. */
  skills: string[];
  available: boolean;
  /** An IANA zone from `TIME_ZONE_OPTIONS`, or `""` for any. */
  time_zone: string;
  new_talent: boolean;
  page: number;
};

export const NO_FILTERS: DirectoryFilters = {
  q: "",
  skills: [],
  available: false,
  time_zone: "",
  new_talent: false,
  page: 1,
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function first(params: Params, name: string): string {
  if (params instanceof URLSearchParams) return params.get(name) ?? "";
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const squash = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
const keyOf = (skill: string) => squash(skill).toLocaleLowerCase("en");
const isListedZone = (zone: string) => TIME_ZONE_OPTIONS.some((option) => option.value === zone);

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
  const zone = first(params, "tz");
  return {
    q: squash(first(params, "q")).slice(0, PORTFOLIO_LIMITS.search),
    skills: normalizeSkills(first(params, "skills").split(",")),
    available: first(params, "available") === "true",
    time_zone: isListedZone(zone) ? zone : "",
    new_talent: first(params, "new_talent") === "true",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function query(filters: DirectoryFilters, planned: boolean): string {
  const params = new URLSearchParams();
  const q = squash(filters.q);
  const skills = normalizeSkills(filters.skills);
  if (q) params.set("q", q);
  if (skills.length) params.set("skills", skills.join(","));
  if (filters.available) params.set("available", "true");
  if (planned && isListedZone(filters.time_zone)) params.set("tz", filters.time_zone);
  if (planned && filters.new_talent) params.set("new_talent", "true");
  if (filters.page > 1) params.set("page", String(filters.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The page's query string, defaults left out: `""` or `?q=…`. */
export function directoryQuery(filters: DirectoryFilters): string {
  return query(filters, true);
}

/** The query string sent to `GET /api/developers/`: without the planned filters. */
export function apiDirectoryQuery(filters: DirectoryFilters): string {
  return query(filters, false);
}

export function hasFilters(filters: DirectoryFilters): boolean {
  return Boolean(squash(filters.q) || filters.skills.length || filters.available || hasPlannedFilters(filters));
}

/** Time zone or New talent is on: the filters that only narrow the loaded page. */
export function hasPlannedFilters(filters: DirectoryFilters): boolean {
  return Boolean(filters.time_zone || filters.new_talent);
}

/**
 * Whether a developer passes the planned filters. With no profile values for
 * them (`undefined`), they pass only when no planned filter is on.
 */
export function matchesPlannedFilters(growth: ProfileGrowth | undefined, filters: DirectoryFilters): boolean {
  if (!hasPlannedFilters(filters)) return true;
  if (!growth) return false;
  if (filters.time_zone && growth.time_zone !== filters.time_zone) return false;
  if (filters.new_talent && !growth.is_new_talent) return false;
  return true;
}
