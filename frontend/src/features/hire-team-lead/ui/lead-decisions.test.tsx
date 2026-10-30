import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadCandidacy } from "@/entities/lead-candidacy";

import type { LeadState } from "../model/use-lead-decisions";
import { LeadDecisions } from "./lead-decisions";

const hook = vi.hoisted(() => ({
  state: { status: "loading" } as LeadState,
  busy: null as string | null,
  error: null as string | null,
  decide: vi.fn(async () => true),
}));
vi.mock("../model/use-lead-decisions", () => ({ useLeadDecisions: () => hook }));

const CLIENT = 1;
const ADA = 2;

const candidacy = (overrides: Partial<LeadCandidacy> = {}): LeadCandidacy => ({
  id: "l1",
  project_id: 10,
  client_account_id: CLIENT,
  developer_account_id: ADA,
  kind: "application",
  status: "candidate",
  note: "I've led React teams.",
  conversation_id: "c1",
  created_at: null,
  decided_at: null,
  actions: { accept: false, decline: false, withdraw: false, hire: true },
  ...overrides,
});

const show = (c: LeadCandidacy, me = CLIENT) => {
  hook.state = { status: "ready", candidacy: c };
  return render(<LeadDecisions candidacyId="l1" myAccountId={me} developerName="Ada" />);
};

describe("LeadDecisions", () => {
  beforeEach(() => {
    hook.busy = null;
    hook.error = null;
    hook.decide.mockClear();
  });

  it("shows where things stand and the developer's note", () => {
    show(candidacy());
    expect(screen.getByRole("status")).toHaveTextContent("Ada is a candidate");
    expect(screen.getByText(/I've led React teams/)).toBeInTheDocument();
  });

  it("asks before hiring, saying the other conversations will close", () => {
    show(candidacy());
    fireEvent.click(screen.getByRole("button", { name: "Hire as Team Lead" }));
    expect(hook.decide).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirm" })).toHaveTextContent(/other candidate's conversation/);
    fireEvent.click(screen.getByRole("button", { name: "Hire Ada" }));
    expect(hook.decide).toHaveBeenCalledWith("hire");
  });

  it("cancel goes back without deciding", () => {
    show(candidacy());
    fireEvent.click(screen.getByRole("button", { name: "Hire as Team Lead" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(hook.decide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Hire as Team Lead" })).toBeInTheDocument();
  });

  it("an invited developer accepts in one click and declines after confirming", () => {
    show(
      candidacy({
        kind: "invitation",
        status: "invited",
        actions: { accept: true, decline: true, withdraw: false, hire: false },
      }),
      ADA,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(hook.decide).toHaveBeenCalledWith("accept");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.getByRole("group", { name: "Confirm" })).toHaveTextContent(/conversation will close/);
  });

  it("shows only the actions the server allows", () => {
    show(candidacy({ status: "hired", actions: { accept: false, decline: false, withdraw: false, hire: false } }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You hired Ada as Team Lead");
  });

  it("disables every action while one is being decided", () => {
    hook.busy = "accept";
    show(
      candidacy({
        kind: "invitation",
        status: "invited",
        actions: { accept: true, decline: true, withdraw: false, hire: false },
      }),
      ADA,
    );
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("shows the server's reason when a decision fails", () => {
    hook.error = "This project already has a Team Lead.";
    show(candidacy());
    expect(screen.getByRole("alert")).toHaveTextContent("This project already has a Team Lead.");
  });
});
