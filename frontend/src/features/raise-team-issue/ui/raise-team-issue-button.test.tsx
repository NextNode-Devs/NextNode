import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { underConstruction } from "@/shared/lib/toast";

import { RaiseTeamIssueButton } from "./raise-team-issue-button";

vi.mock("@/shared/lib/toast", () => ({ underConstruction: vi.fn() }));

const TRIGGER = { name: "Raise an issue with your Team Lead" };

describe("RaiseTeamIssueButton", () => {
  beforeEach(() => vi.mocked(underConstruction).mockClear());

  it("names the Team Lead and marks the dialog as a prototype", async () => {
    const user = userEvent.setup();
    render(<RaiseTeamIssueButton leadName="Sam Lee" />);
    await user.click(screen.getByRole("button", TRIGGER));
    const dialog = await screen.findByRole("dialog", TRIGGER);
    expect(dialog).toHaveAccessibleDescription(/Sam Lee sees what you write here/);
    expect(dialog).toHaveTextContent("Prototype");
  });

  it("shows the errors on the fields and sends nothing when empty", async () => {
    const user = userEvent.setup();
    render(<RaiseTeamIssueButton leadName="Sam Lee" />);
    await user.click(screen.getByRole("button", TRIGGER));
    await user.click(await screen.findByRole("button", { name: "Send to Team Lead" }));
    expect(screen.getByText("Choose what the issue is about.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /What happened/ })).toHaveAccessibleDescription(
      expect.stringContaining("Describe the issue."),
    );
    expect(underConstruction).not.toHaveBeenCalled();
  });

  it("closes and shows the under-construction toast once valid, returning focus", async () => {
    const user = userEvent.setup();
    render(<RaiseTeamIssueButton leadName="Sam Lee" />);
    await user.click(screen.getByRole("button", TRIGGER));
    await user.click(await screen.findByRole("radio", { name: "Deadlines or milestones" }));
    await user.type(screen.getByRole("textbox", { name: /What happened/ }), "The demo date keeps moving.");
    await user.click(screen.getByRole("button", { name: "Send to Team Lead" }));
    expect(underConstruction).toHaveBeenCalledWith("Raise an issue with your Team Lead");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", TRIGGER)).toHaveFocus();
  });

  it("starts empty again after Cancel", async () => {
    const user = userEvent.setup();
    render(<RaiseTeamIssueButton leadName="Sam Lee" />);
    await user.click(screen.getByRole("button", TRIGGER));
    await user.type(await screen.findByRole("textbox", { name: /What happened/ }), "Draft text");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", TRIGGER));
    expect(await screen.findByRole("textbox", { name: /What happened/ })).toHaveValue("");
  });
});
