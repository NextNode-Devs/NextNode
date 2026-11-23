import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RatingCard } from "./rating-card";

const rated = {
  account_id: 1,
  from_clients: { average: 4.8, count: 5 },
  from_leads: { average: 4.5, count: 2 },
};
const fresh = { account_id: 2, from_clients: { average: null, count: 0 }, from_leads: { average: null, count: 0 } };

describe("RatingCard", () => {
  it("opens on keyboard focus with a bar and count for clients and Team Leads; Escape closes it", async () => {
    const user = userEvent.setup();
    render(<RatingCard summary={rated} />);
    const trigger = screen.getByRole("button", { name: /Rated 4.7 out of 5 from 7 ratings/ });
    await user.tab();
    expect(trigger).toHaveFocus();
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("From clients4.8 · 5 ratings");
    expect(card).toHaveTextContent("From Team Leads4.5 · 2 ratings");
    expect(screen.getAllByTestId("rating-bar")).toHaveLength(2);
    expect(trigger).toHaveAccessibleDescription(/From clients/);
    await user.keyboard("{Escape}");
    // Gone once its fade-out finishes.
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("opens on hover and closes when the pointer leaves", async () => {
    const user = userEvent.setup();
    render(<RatingCard summary={rated} />);
    await user.hover(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.unhover(screen.getByRole("button"));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("opens on tap and stays open on a second tap", async () => {
    const user = userEvent.setup();
    render(<RatingCard summary={rated} />);
    await user.pointer({ keys: "[TouchA]", target: screen.getByRole("button") });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it('says "New, no ratings yet" when there are none', async () => {
    const user = userEvent.setup();
    render(<RatingCard summary={fresh} />);
    expect(screen.getByRole("button", { name: /New, no ratings yet/ })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("New, no ratings yet");
    expect(screen.queryAllByTestId("rating-bar")).toHaveLength(0);
  });

  it("shows a kind with no ratings as such", async () => {
    const user = userEvent.setup();
    render(<RatingCard summary={{ ...rated, from_leads: { average: null, count: 0 } }} />);
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("From Team LeadsNo ratings yet");
  });
});
