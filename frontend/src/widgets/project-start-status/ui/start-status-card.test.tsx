import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Offer, StartGate } from "@/entities/start-gate";

import { StartStatusCard } from "./start-status-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/close-proposal", () => ({ CloseProposal: () => <p>close proposal control</p> }));
vi.mock("@/features/send-offer", () => ({ SendOfferForm: () => <p>send offer form</p> }));
vi.mock("@/features/accept-offer", () => ({ DecideOffer: () => <p>decide offer controls</p> }));
vi.mock("@/features/finalize-timeline", () => ({ FinalizeTimelineForm: () => <p>timeline form</p> }));
vi.mock("@/features/make-deposit", () => ({
  PayDepositCard: ({ depositCents }: { depositCents: number }) => <p>pay deposit of {depositCents}</p>,
}));

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  id: 1,
  version: 1,
  status: "sent",
  summary: "Five sprints.",
  total_cents: 1_000_000,
  deposit_cents: 200_000,
  currency: "cad",
  start_date: "2026-11-09",
  delivery_date: "2027-02-01",
  signed_by: { account_id: 2, display_name: "Ada" },
  signed_at: "2026-11-01T12:00:00Z",
  decided_by: null,
  decided_at: null,
  decline_reason: null,
  ...overrides,
});

const gate = (overrides: Partial<StartGate> = {}): StartGate => ({
  project_id: 4,
  kind: "client",
  project_status: "Posted",
  team_status: "locked",
  conditions: [
    { key: "team_locked", label: "Team full and proposal closed", met: true },
    { key: "offer_accepted", label: "Offer accepted by the client", met: false },
    { key: "deposit_confirmed", label: "Deposit confirmed by Stripe", met: false },
  ],
  next_actor: "lead",
  next_step: "The Team Lead sends the client a signed offer.",
  started: false,
  viewer_role: "lead",
  actions: [],
  proposed_budget_cents: 200_000,
  deposit_percent: 20,
  offers: [],
  deposit: { status: "none", amount_cents: null, currency: null, completed_at: null },
  timeline: null,
  workspace_conversation_id: null,
  ...overrides,
});

const show = (g: StartGate) => render(<StartStatusCard gate={g} targetDeliveryDate="2027-01-01" />);

describe("StartStatusCard", () => {
  it("lists each condition with its state, and whose turn it is", () => {
    show(gate({ actions: ["send_offer"] }));
    const steps = screen.getByRole("list", { name: "Start conditions" });
    expect(steps).toHaveTextContent("Done: Team full and proposal closed");
    expect(steps).toHaveTextContent("Not done yet: Deposit confirmed by Stripe");
    expect(screen.getByText("Your turn")).toBeInTheDocument();
    expect(screen.getByText("Your next step:")).toBeInTheDocument();
    expect(screen.getByText("send offer form")).toBeInTheDocument();
  });

  it("shows a member the status read-only, with a way to check for updates", () => {
    show(gate({ viewer_role: "member" }));
    expect(screen.getByText("Team Lead's turn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
    expect(screen.queryByText("send offer form")).not.toBeInTheDocument();
  });

  it("gives the client the open offer to decide, next to their proposed budget", () => {
    show(gate({ viewer_role: "client", next_actor: "client", actions: ["decide_offer"], offers: [offer()] }));
    expect(screen.getByText("Offer version 1")).toBeInTheDocument();
    expect(screen.getByText("Client's proposed budget: CAD 2,000.00")).toBeInTheDocument();
    expect(screen.getByText("CAD 10,000.00")).toBeInTheDocument();
    expect(screen.getByText("decide offer controls")).toBeInTheDocument();
  });

  it("keeps earlier versions readable behind a disclosure", () => {
    const declined = offer({
      status: "declined",
      decline_reason: "Too high",
      decided_by: { account_id: 1, display_name: "Grace" },
      decided_at: "2026-11-01T13:00:00Z",
    });
    show(gate({ offers: [offer({ id: 2, version: 2 }), declined] }));
    expect(screen.getByText("Earlier versions (1)")).toBeInTheDocument();
    expect(screen.getByText("Too high")).toBeInTheDocument();
  });

  it("offers the deposit from the accepted offer", () => {
    show(
      gate({
        viewer_role: "client",
        next_actor: "client",
        project_status: "Assigned",
        actions: ["pay_deposit"],
        offers: [offer({ status: "accepted" })],
      }),
    );
    expect(screen.getByText("pay deposit of 200000")).toBeInTheDocument();
  });

  it("links team members to the workspace chat once started", () => {
    show(gate({ started: true, next_actor: "nobody", viewer_role: "member", workspace_conversation_id: "abc" }));
    expect(screen.getByText("Work has started")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /team workspace chat/ })).toHaveAttribute("href", "/conversations/abc");
  });

  it("never links the client to the workspace chat", () => {
    show(gate({ started: true, next_actor: "nobody", viewer_role: "client" }));
    expect(screen.queryByRole("link", { name: /workspace/ })).not.toBeInTheDocument();
    expect(screen.getByText(/existing chat/)).toBeInTheDocument();
  });

  it("says a developer idea needs no payment", () => {
    show(gate({ kind: "developer", offers: null, deposit: null, actions: ["finalize_timeline"] }));
    expect(screen.getByText(/No payment applies/)).toBeInTheDocument();
    expect(screen.getByText("timeline form")).toBeInTheDocument();
  });
});
