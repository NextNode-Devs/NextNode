import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { underConstruction } from "@/shared/lib/toast";

import { GithubImport } from "./github-import";

vi.mock("@/shared/lib/toast", () => ({ underConstruction: vi.fn() }));

describe("GithubImport", () => {
  it("is marked as a prototype and shows the under-construction toast instead of importing", async () => {
    const user = userEvent.setup();
    render(<GithubImport />);
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Import from GitHub" });
    // A plain button, so pressing it inside the portfolio form never submits the form.
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(underConstruction).toHaveBeenCalledWith("Import from GitHub");
  });
});
