import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamChangesPanel } from "./team-changes-panel";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (f: string) => underConstruction(f) }));

beforeEach(() => underConstruction.mockClear());

describe("TeamChangesPanel", () => {
  it("lets the Lead remove a member, after confirming", async () => {
    render(<TeamChangesPanel projectId={4} viewer="lead" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove Marco Ruiz (sample)" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Marco Ruiz (sample)?" });
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(underConstruction).toHaveBeenCalledWith("Removing Marco Ruiz (sample)");
  });

  it("gives the client no remove or leave buttons", () => {
    render(<TeamChangesPanel projectId={4} viewer="client" />);
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Leave|Step down/ })).toBeNull();
  });

  it("asks the Lead to pick a replacement once a member left", async () => {
    render(<TeamChangesPanel projectId={4} viewer="lead" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "A member left" }));
    expect(screen.getByRole("heading", { name: "1 open spot" })).toBeInTheDocument();
    expect(screen.getByText("Left", { selector: "[data-slot=badge]" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add to the team" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose someone to add to the team.");
    await user.click(screen.getByRole("radio", { name: /Noah Patel/ }));
    await user.click(screen.getByRole("button", { name: "Add to the team" }));
    expect(underConstruction).toHaveBeenCalledWith("Adding Noah Patel (sample) to the team");
  });

  it("shows members the unresponsive banner and lets them propose a Lead", async () => {
    render(<TeamChangesPanel projectId={4} viewer="member" initial="lead_unresponsive" />);
    expect(screen.getByText("Ada Okafor (sample) hasn't responded for 3 days")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Marco Ruiz (sample)" }));
    await user.click(screen.getByRole("button", { name: "Send to the client" }));
    expect(underConstruction).toHaveBeenCalledWith("Proposing a new Lead");
  });

  it("lets only the client approve the proposed Lead", async () => {
    const { unmount } = render(<TeamChangesPanel projectId={4} viewer="member" initial="lead_proposed" />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText("Waiting for the client to approve Marco Ruiz (sample).")).toBeInTheDocument();
    unmount();

    render(<TeamChangesPanel projectId={4} viewer="client" initial="lead_proposed" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", { name: "Approve Marco Ruiz (sample) as Team Lead?" });
    expect(dialog).toHaveTextContent("signs offer version 3 next");
    await user.click(within(dialog).getByRole("button", { name: "Approve Marco Ruiz (sample)" }));
    expect(underConstruction).toHaveBeenCalledWith("Approving Marco Ruiz (sample) as Team Lead");
  });
});
