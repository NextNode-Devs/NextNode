import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { getToasts, resetToasts } from "@/shared/lib/toast";

import { RatingsPanel } from "./ratings-panel";

afterEach(() => act(() => resetToasts()));

describe("RatingsPanel", () => {
  it("lets the client rate the Team Lead and the team, needing stars for both", async () => {
    const user = userEvent.setup();
    render(<RatingsPanel viewer="client" />);
    await user.click(screen.getByRole("button", { name: "Send ratings" }));
    expect(screen.getByText("Choose 1 to 5 stars for Ada (Team Lead).")).toBeInTheDocument();
    expect(getToasts()).toHaveLength(0);

    const lead = screen.getByRole("group", { name: "Ada (Team Lead)" });
    await user.click(within(lead).getByLabelText("5 stars"));
    await user.type(within(lead).getByLabelText("Comment (optional)"), "Great updates.");
    await user.click(within(screen.getByRole("group", { name: "The team" })).getByLabelText("4 stars"));
    await user.click(screen.getByRole("button", { name: "Send ratings" }));

    expect(getToasts().at(-1)?.description).toBe("Send ratings: this function is under construction.");
    expect(screen.getByText("Preview only")).toBeInTheDocument();
    expect(screen.getByText("Great updates.")).toBeInTheDocument();
  });

  it("lets the Team Lead rate each member and write a Team Lead reference", () => {
    render(<RatingsPanel viewer="lead" />);
    for (const name of ["Margaret", "Lee", "Sam"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByLabelText("Team Lead reference (optional)")).toHaveLength(3);
    expect(screen.getByText("Shown on Margaret's portfolio as a Team Lead reference.")).toBeInTheDocument();
  });

  it("gives members nothing to rate", () => {
    render(<RatingsPanel viewer="member" />);
    expect(screen.getByText("Your client and Team Lead rate you")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send ratings" })).not.toBeInTheDocument();
  });

  it("stays closed until the project is completed, and shows ratings already sent", async () => {
    const user = userEvent.setup();
    render(<RatingsPanel viewer="client" initial="not_completed" />);
    expect(screen.getByText("Ratings open when the project is completed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Already rated" }));
    expect(screen.getByRole("heading", { name: "Your ratings" })).toBeInTheDocument();
    expect(screen.getByText("Clear updates every week.")).toBeInTheDocument();
  });
});
