import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SAMPLE_ARCHIVED_CONVERSATIONS, sampleClosing } from "@/entities/project";
import { getToasts, resetToasts } from "@/shared/lib/toast";

import { ArchivedProject } from "./archived-project";

afterEach(() => act(() => resetToasts()));

describe("ArchivedProject", () => {
  it("is read-only: conversations are shown but nobody can write", () => {
    render(<ArchivedProject closing={sampleClosing("archived", 3)} conversations={SAMPLE_ARCHIVED_CONVERSATIONS} />);
    expect(screen.getByText(/Archived on Jan 22, 2027/)).toBeInTheDocument();
    expect(screen.getByText("Production deploy is green.")).toBeInTheDocument();
    for (const input of screen.getAllByRole("textbox")) {
      expect(input).toBeDisabled();
      expect(input).toHaveAccessibleDescription("This project is archived, so nobody can send new messages.");
    }
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Code ownership after final payment")).toBeInTheDocument();
  });

  it("says how the project shows on portfolios", () => {
    const { rerender } = render(<ArchivedProject closing={sampleClosing("archived", 3)} conversations={[]} />);
    expect(screen.getByText('Listed under "Shipped projects"')).toBeInTheDocument();
    expect(screen.getByText(/weren't part of any conversation/)).toBeInTheDocument();
    rerender(<ArchivedProject closing={sampleClosing("archived", 3, true)} conversations={[]} />);
    expect(screen.getByText("Confidential: kept off portfolios")).toBeInTheDocument();
  });

  it("download is under construction", async () => {
    const user = userEvent.setup();
    render(<ArchivedProject closing={sampleClosing("archived", 3)} conversations={[]} />);
    await user.click(screen.getByRole("button", { name: "Download the project archive" }));
    expect(getToasts().at(-1)?.description).toBe("Download the project archive: this function is under construction.");
  });
});
