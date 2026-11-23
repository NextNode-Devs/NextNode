import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getToasts, resetToasts } from "@/shared/lib/toast";

import { MilestoneReviewPanel } from "./milestone-review-panel";

// The error state's "Check again" button refreshes through the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => act(() => resetToasts()));

type Viewer = "client" | "lead" | "member";
type Initial = Parameters<typeof MilestoneReviewPanel>[0]["initial"];

function renderAs(viewer: Viewer, initial?: Initial) {
  return render(
    <MilestoneReviewPanel viewer={viewer} viewerName={viewer === "client" ? "Grace" : "Ada"} depositReleaseMilestone={2} initial={initial} />,
  );
}

const card = (title: string) => screen.getByRole("article", { name: title });

describe("MilestoneReviewPanel", () => {
  it("shows every milestone with its state, the deposit milestone and progress", () => {
    renderAs("client");
    expect(screen.getByText("1 of 4 approved")).toBeInTheDocument();
    expect(within(card("Designs and project setup")).getByText("Completed")).toBeInTheDocument();
    expect(within(card("Designs and project setup")).getByText("Revised once")).toBeInTheDocument();
    const second = card("Accounts and booking flow");
    expect(within(second).getByText("Under review")).toBeInTheDocument();
    expect(within(second).getByText("Releases the deposit")).toBeInTheDocument();
    expect(within(second).getByText("Planned")).toBeInTheDocument();
  });

  it("lets the client approve: completed, the next milestone starts, under construction toast", async () => {
    const user = userEvent.setup();
    renderAs("client");
    const second = card("Accounts and booking flow");
    await user.click(within(second).getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", { name: "Approve milestone 2?" });
    expect(within(dialog).getByText(/no longer refundable/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Approve milestone" }));

    expect(within(card("Accounts and booking flow")).getByText("Completed")).toBeInTheDocument();
    expect(within(card("Payments and notifications")).getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 approved")).toBeInTheDocument();
    expect(screen.getByText("Preview only")).toBeInTheDocument();
    expect(getToasts().at(-1)?.description).toBe("Approve milestone: this function is under construction.");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Accounts and booking flow" })).toHaveFocus());
  });

  it("lets the client ask for changes, which needs a note and sends the milestone back", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(within(card("Accounts and booking flow")).getByRole("button", { name: "Request changes" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Send back to the team" }));
    expect(within(dialog).getByText("Say what needs to change.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/What needs to change/), "The email is missing the time.");
    await user.click(within(dialog).getByRole("button", { name: "Send back to the team" }));

    const second = card("Accounts and booking flow");
    expect(within(second).getByText("In progress")).toBeInTheDocument();
    expect(within(second).getByText("Revised 2 times")).toBeInTheDocument();
    expect(within(second).getByText("The email is missing the time.")).toBeInTheDocument();
    expect(within(second).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("lets the Lead resubmit after a revision, with an optional https link", async () => {
    const user = userEvent.setup();
    renderAs("lead", "revision_requested");
    const second = card("Accounts and booking flow");
    expect(within(second).getByText("Submit the work when it's ready for the client to review.")).toBeInTheDocument();
    await user.click(within(second).getByRole("button", { name: "Resubmit for review" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/What changed/), "Fixed both.");
    await user.type(within(dialog).getByLabelText(/Link to the work/), "staging.example.com");
    await user.click(within(dialog).getByRole("button", { name: "Send to the client" }));
    expect(within(dialog).getByText(/Enter a full link/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/Link to the work/));
    await user.type(within(dialog).getByLabelText(/Link to the work/), "https://staging.example.com/v2");
    await user.click(within(dialog).getByRole("button", { name: "Send to the client" }));

    expect(within(card("Accounts and booking flow")).getByText("Under review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /staging.example.com\/v2/ })).toHaveAttribute("target", "_blank");
    expect(getToasts().at(-1)?.description).toBe("Submit milestone for review: this function is under construction.");
  });

  it("gives the Lead no review buttons and members no buttons at all", () => {
    renderAs("lead");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Waiting for the client to approve it or ask for changes.")).toHaveLength(1);

    renderAs("member", "revision_requested");
    expect(screen.queryByRole("button", { name: /Submit|Resubmit/ })).not.toBeInTheDocument();
  });

  it("draws waiting for the deposit, all approved, empty and error states", async () => {
    const user = userEvent.setup();
    renderAs("client", "awaiting_deposit");
    expect(screen.getAllByText("Pending deposit")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Approve|Request changes/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All completed" }));
    await user.click(screen.getByRole("button", { name: "Give final approval" }));
    expect(getToasts().at(-1)?.description).toBe("Final approval: this function is under construction.");

    await user.click(screen.getByRole("button", { name: "No milestones yet" }));
    expect(screen.getByRole("heading", { name: "No milestones yet" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Couldn't load" }));
    expect(screen.getByText("We couldn't load the milestones")).toBeInTheDocument();
  });

  it("resets the preview back to the sample", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(within(card("Accounts and booking flow")).getByRole("button", { name: "Approve" }));
    await user.click(await screen.findByRole("button", { name: "Approve milestone" }));
    await user.click(screen.getByRole("button", { name: "Reset the sample" }));
    expect(within(card("Accounts and booking flow")).getByText("Under review")).toBeInTheDocument();
    expect(screen.queryByText("Preview only")).not.toBeInTheDocument();
  });
});
