import type { ApiResult } from "@/shared/api/types";

import type { Viewer } from "../model/viewer";

export type ViewerRoute =
  | { kind: "sign-in" }
  | { kind: "onboarding" }
  | { kind: "dashboard"; viewer: Viewer & { account: NonNullable<Viewer["account"]> } }
  | { kind: "error"; message: string };

/**
 * Where a viewer belongs. Pure, so the onboarding and dashboard pages share
 * one rule: no account → onboarding; an account → dashboard, never onboarding.
 */
export function routeFor(result: ApiResult<Viewer>): ViewerRoute {
  if (!result.ok) {
    if (result.error.code === "UNAUTHENTICATED") return { kind: "sign-in" };
    return { kind: "error", message: result.error.message };
  }
  const { account } = result.data;
  if (account === null) return { kind: "onboarding" };
  return { kind: "dashboard", viewer: { ...result.data, account } };
}
