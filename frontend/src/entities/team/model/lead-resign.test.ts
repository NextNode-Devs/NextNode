import { describe, expect, it } from "vitest";

import { isAccessRemovalReason } from "./access-removal";
import { replacementSignature, resignViewer } from "./lead-resign";
import { sampleAccessRemoval, sampleLeadResign, SAMPLE_RESIGN_SITUATIONS } from "./lead-resign-sample";

const viewer = (over: Partial<{ is_owner: boolean; is_lead: boolean; is_member: boolean }>) => ({
  is_owner: false,
  is_lead: false,
  is_member: false,
  ...over,
});

describe("resignViewer", () => {
  it("lets the client follow along and the team see the signing screen", () => {
    expect(resignViewer(viewer({ is_owner: true }))).toBe("client");
    expect(resignViewer(viewer({ is_lead: true }))).toBe("new_lead");
    expect(resignViewer(viewer({ is_member: true }))).toBe("new_lead");
  });

  it("gives someone outside the project nothing", () => {
    expect(resignViewer(viewer({}))).toBeNull();
  });
});

describe("replacementSignature", () => {
  it("is missing until the client approves, then waits, then is signed", () => {
    expect(replacementSignature(sampleLeadResign("awaiting_approval"))).toBeUndefined();
    expect(replacementSignature(sampleLeadResign("ready_to_sign"))?.signed_at).toBeNull();
    expect(replacementSignature(sampleLeadResign("signed"))?.signed_at).toBe("2026-11-21T14:20:00Z");
  });
});

describe("lead re-sign sample", () => {
  it("keeps the offer version the client already accepted in every situation", () => {
    for (const situation of SAMPLE_RESIGN_SITUATIONS) {
      const snapshot = sampleLeadResign(situation);
      expect(snapshot.offer.version).toBe(3);
      expect(snapshot.offer.status).toBe("accepted");
      expect(snapshot.signatures[0]).toMatchObject({ kind: "original", lead: snapshot.outgoing_lead });
    }
  });

  it("marks every name as sample data", () => {
    const snapshot = sampleLeadResign("signed");
    for (const name of [snapshot.new_lead, snapshot.outgoing_lead, snapshot.client].map((p) => p.display_name)) {
      expect(name).toMatch(/\(sample\)$/);
    }
    expect(sampleAccessRemoval("removed").project.title).toMatch(/\(sample\)$/);
  });
});

describe("isAccessRemovalReason", () => {
  it("accepts the three reasons and nothing else", () => {
    expect(["left", "removed", "lead_replaced"].every(isAccessRemovalReason)).toBe(true);
    expect(isAccessRemovalReason("banned")).toBe(false);
    expect(isAccessRemovalReason(undefined)).toBe(false);
  });
});
