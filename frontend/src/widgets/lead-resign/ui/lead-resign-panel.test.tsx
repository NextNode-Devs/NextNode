import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadResignPanel } from "./lead-resign-panel";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (f: string) => underConstruction(f) }));

beforeEach(() => underConstruction.mockClear());

describe("LeadResignPanel", () => {
  it("asks the new Lead to confirm before signing", async () => {
    render(<LeadResignPanel projectId={4} viewer="new_lead" />);
    expect(screen.getByRole("heading", { name: "Sign offer version 3 to take over" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign version 3" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm you've read version 3 before you sign.");
    expect(underConstruction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /I've read offer version 3/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign version 3" }));
    expect(underConstruction).toHaveBeenCalledWith("Signing offer version 3 as Team Lead");
  });

  it("shows the offer terms and who still has to sign", () => {
    render(<LeadResignPanel projectId={4} viewer="new_lead" />);
    expect(screen.getByRole("heading", { name: "Offer version 3" })).toBeInTheDocument();
    const signatures = screen.getByRole("list", { name: "Team Lead signatures" });
    expect(within(signatures).getByText("Marco Ruiz (sample) (you)")).toBeInTheDocument();
    expect(signatures).toHaveTextContent("signature needed");
  });

  it("lets the new Lead step back, after confirming", async () => {
    render(<LeadResignPanel projectId={4} viewer="new_lead" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "I can't lead this" }));
    const dialog = await screen.findByRole("dialog", { name: "Step back from leading?" });
    await user.click(within(dialog).getByRole("button", { name: "Step back" }));
    expect(underConstruction).toHaveBeenCalledWith("Stepping back from leading");
  });

  it("has nothing to sign before the client approves", async () => {
    render(<LeadResignPanel projectId={4} viewer="new_lead" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Not approved yet" }));
    expect(screen.getByRole("heading", { name: "Nothing to sign yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign version/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Offer version 3" })).toBeNull();
  });

  it("gives the client no signing controls", async () => {
    render(<LeadResignPanel projectId={4} viewer="client" />);
    expect(screen.getByRole("heading", { name: "Waiting for Marco Ruiz (sample) to sign" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign version/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Signed" }));
    expect(screen.getByRole("heading", { name: "Marco Ruiz (sample) is the Team Lead" })).toBeInTheDocument();
  });

  it("links to what the former Lead sees", () => {
    render(<LeadResignPanel projectId={4} viewer="client" />);
    expect(screen.getByRole("link", { name: "See what the former Lead sees" })).toHaveAttribute(
      "href",
      "/projects/4/no-access?reason=lead_replaced",
    );
  });
});
