import { describe, expect, it } from "vitest";

import type { MyLeadCandidacy } from "@/entities/lead-candidacy";

import { pickFor } from "./pick";

const item = (id: string, kind: MyLeadCandidacy["kind"], status: MyLeadCandidacy["status"]): MyLeadCandidacy => ({
  candidacy_id: id,
  project_id: 1,
  project_title: "Shop",
  kind,
  status,
  client_name: "Grace",
  developer_name: "Ada",
  conversation_id: `c-${id}`,
  created_at: null,
});

describe("pickFor", () => {
  const items = [item("a", "application", "closed"), item("b", "invitation", "invited"), item("c", "application", "candidate")];

  it("splits a developer's invitations from their applications", () => {
    expect(pickFor(items, "invitation").map((i) => i.candidacy_id)).toEqual(["b"]);
    expect(pickFor(items, "application").map((i) => i.candidacy_id)).toEqual(["c", "a"]);
  });

  it("puts open ones first and keeps the API's newest-first order within a group", () => {
    expect(pickFor(items, "all").map((i) => i.candidacy_id)).toEqual(["b", "c", "a"]);
  });
});
