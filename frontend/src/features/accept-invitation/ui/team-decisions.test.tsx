import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamCandidacy } from "@/entities/team";

import type { TeamState } from "../model/use-team-decisions";
import { TeamDecisions } from "./team-decisions";

const hook = vi.hoisted(() => ({
  state: { status: "loading" } as TeamState,
  busy: null as string | null,
  error: null as string | null,
  decide: vi.fn(async () => true),
}));
vi.mock("../model/use-team-decisions", () => ({ useTeamDecisions: () => hook }));

const LEAD = 1;
const ADA = 2;

const candidacy = (overrides: Partial<TeamCandidacy> = {}): TeamCandidacy => ({
  id: "t1",
  project_id: 10,
  lead_account_id: LEAD,
  developer_account_id: ADA,
  kind: "invitation",
  status: "pending",
  closed_reason: "",
  conversation_id: "c1",
  created_at: null,
  decided_at: null,
  actions: { accept: true, reject: false, withdraw: false, decline: true },
  ...overrides,
});

const show = (c: TeamCandidacy, me = ADA) => {
  hook.state = { status: "ready", candidacy: c };
  return render(<TeamDecisions candidacyId="t1" myAccountId={me} otherName="Linus" />);
};

describe("TeamDecisions", () => {
  beforeEach(() => {
    hook.busy = null;
    hook.error = null;
    hook.decide.mockClear();
  });

  it("lets an invitee accept in one click and links to the project", () => {
    const invitation = candidacy();
    show(invitation);
    expect(screen.getByRole("status")).toHaveTextContent("only if you accept");
    expect(screen.getByRole("link", { name: "View the project" })).toHaveAttribute("href", "/projects/10");
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(hook.decide).toHaveBeenCalledWith(invitation, "accept");
  });

  it("asks before declining, saying the conversation will close", () => {
    const invitation = candidacy();
    show(invitation);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(hook.decide).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirm" })).toHaveTextContent(/conversation will close/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(hook.decide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument();
  });

  it("never offers the Team Lead an invitee's accept", () => {
    show(candidacy({ actions: { accept: false, reject: false, withdraw: false, decline: false } }), LEAD);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for Linus");
  });

  it("lets the Team Lead accept or reject an application", () => {
    const application = candidacy({
      kind: "application",
      actions: { accept: true, reject: true, withdraw: false, decline: false },
    });
    show(application, LEAD);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("group", { name: "Confirm" }).querySelector("button")!);
    expect(hook.decide).toHaveBeenCalledWith(application, "reject");
  });

  it("shows the closed reason and no actions once closed", () => {
    show(
      candidacy({
        status: "closed",
        closed_reason: "The team is full",
        actions: { accept: false, reject: false, withdraw: false, decline: false },
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("The team is full");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables every action while one is being decided", () => {
    hook.busy = "accept";
    show(candidacy());
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("shows the server's reason when a decision fails, such as losing the last spot", () => {
    hook.error = "This invitation is closed: The team is full.";
    show(candidacy());
    expect(screen.getByRole("alert")).toHaveTextContent("The team is full");
  });
});
