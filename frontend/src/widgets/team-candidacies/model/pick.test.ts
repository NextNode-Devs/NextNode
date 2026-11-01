import { describe, expect, it } from "vitest";

import type { MyTeamCandidacy } from "@/entities/team";

import { pickFor } from "./pick";

const item = (id: string, overrides: Partial<MyTeamCandidacy>): MyTeamCandidacy => ({
  candidacy_id: id,
  project_id: 1,
  project_title: "Booking app",
  kind: "application",
  status: "pending",
  closed_reason: "",
  my_part: "developer",
  lead_name: "Ada",
  developer_name: "Linus",
  conversation_id: "c",
  created_at: null,
  actions: { accept: false, reject: false, withdraw: false, decline: false },
  ...overrides,
});

const ids = (items: MyTeamCandidacy[]) => items.map((i) => i.candidacy_id);

describe("pickFor", () => {
  const received = item("received", { kind: "invitation" });
  const sent = item("sent", { kind: "invitation", my_part: "lead" });
  const mine = item("mine", {});
  const toMyTeam = item("to-my-team", { my_part: "lead" });

  it("keeps invitations a developer received apart from everything else", () => {
    const all = [received, sent, mine, toMyTeam];
    expect(ids(pickFor(all, "invitations"))).toEqual(["received"]);
    expect(ids(pickFor(all, "applications"))).toEqual(["sent", "mine", "to-my-team"]);
  });

  it("puts what is still pending first, otherwise keeping the API's order", () => {
    const closed = item("closed", { status: "closed" });
    expect(ids(pickFor([closed, mine, toMyTeam], "applications"))).toEqual(["mine", "to-my-team", "closed"]);
  });
});
