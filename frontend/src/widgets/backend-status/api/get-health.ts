import "server-only";

import { apiGet } from "@/shared/api/server-client";

export type Health = {
  status: "ok" | "degraded";
  database: "ok" | "unavailable";
  auth: "configured" | "unconfigured";
};

export function getHealth() {
  return apiGet<Health>("/api/health/");
}
