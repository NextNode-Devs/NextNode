import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AccessRemovedPanel } from "./access-removed-panel";

describe("AccessRemovedPanel", () => {
  it("says who removed you, what closed and what stays", () => {
    render(<AccessRemovedPanel />);
    expect(screen.getByRole("heading", { name: "Event ticketing (sample)" })).toBeInTheDocument();
    expect(screen.getByText(/Ada Okafor \(sample\), the Team Lead, removed you from the team/)).toBeInTheDocument();
    expect(screen.queryByText(/\.\./)).toBeNull();
    expect(screen.getByRole("heading", { name: "Closed to you now" })).toBeInTheDocument();
    expect(screen.getByText("Team chat")).toBeInTheDocument();
    expect(screen.getByText(/Your messages, files and updates stay with the project/)).toBeInTheDocument();
  });

  it("explains each way access ends", async () => {
    render(<AccessRemovedPanel initial="left" />);
    expect(screen.getByText(/you left the team\./)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "You were replaced as Lead" }));
    expect(screen.getByRole("button", { name: "You were replaced as Lead" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/the team proposed Marco Ruiz \(sample\)/)).toBeInTheDocument();
    expect(screen.getByText(/Your signature on the offer stays on record/)).toBeInTheDocument();
  });

  it("never leaves you at a dead end", () => {
    render(<AccessRemovedPanel />);
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Find another project" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
  });
});
