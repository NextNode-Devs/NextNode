import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SAMPLE_VIDEO_LINKS } from "@/entities/video-link";

import { NextMeetingCard } from "./next-meeting-card";
import { VideoLinksCard } from "./video-links-card";

const NOW = "2026-11-20T12:00:00Z";

describe("VideoLinksCard", () => {
  it("lists recurring and upcoming meetings with a link out, and past ones by month without one", () => {
    render(<VideoLinksCard links={SAMPLE_VIDEO_LINKS} now={NOW} />);
    const recurring = screen.getByRole("region", { name: "Recurring" });
    expect(within(recurring).getByText(/Mondays and Thursdays, 10:00 a.m./)).toBeInTheDocument();

    const upcoming = screen.getByRole("region", { name: "Upcoming" });
    const join = within(upcoming).getAllByRole("link");
    expect(join[0]).toHaveAccessibleName(/Join \(Zoom\)/);
    expect(join[0]).toHaveAttribute("target", "_blank");

    expect(screen.getByText("Past meetings (3)")).toBeInTheDocument();
    const november = screen.getByRole("region", { name: "Past meetings, November 2026" });
    expect(within(november).getAllByRole("listitem")).toHaveLength(2);
    expect(within(november).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Past meetings, October 2026" })).toBeInTheDocument();
  });

  it("says when there are no links yet", () => {
    render(<VideoLinksCard links={[]} now={NOW} />);
    expect(screen.getByText("No meeting links yet")).toBeInTheDocument();
  });
});

describe("NextMeetingCard", () => {
  it("shows the soonest meeting, and nothing once none is coming", () => {
    const { unmount } = render(<NextMeetingCard links={SAMPLE_VIDEO_LINKS} now={NOW} allLinksHref="/projects/4/meetings" />);
    expect(screen.getByText("Account pages demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All meetings" })).toHaveAttribute("href", "/projects/4/meetings");
    unmount();

    const { container } = render(<NextMeetingCard links={SAMPLE_VIDEO_LINKS} now="2027-06-01T00:00:00Z" allLinksHref="#" />);
    expect(container).toBeEmptyDOMElement();
  });
});
