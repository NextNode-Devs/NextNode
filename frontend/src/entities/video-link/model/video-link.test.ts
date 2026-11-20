import { describe, expect, it } from "vitest";

import { SAMPLE_VIDEO_LINKS } from "./sample";
import { describeWeekly, groupVideoLinks, meetingProvider, nextMeeting } from "./video-link";

describe("meetingProvider", () => {
  it("names the common providers from the link's host", () => {
    expect(meetingProvider("https://us02web.zoom.us/j/1")).toBe("Zoom");
    expect(meetingProvider("https://meet.google.com/abc")).toBe("Google Meet");
    expect(meetingProvider("https://teams.microsoft.com/l/x")).toBe("Teams");
  });

  it("says just 'meeting' for anything else, including a broken link", () => {
    expect(meetingProvider("https://whereby.com/team")).toBe("meeting");
    expect(meetingProvider("not a url")).toBe("meeting");
  });
});

describe("describeWeekly", () => {
  it("lists the days in week order, then the time", () => {
    expect(describeWeekly(["thu", "mon"], "10:00")).toBe("Mondays and Thursdays, 10:00 a.m.");
    expect(describeWeekly(["fri"], "09:30")).toBe("Fridays, 9:30 a.m.");
    expect(describeWeekly(["wed", "mon", "fri"], "16:00")).toBe("Mondays, Wednesdays and Fridays, 4:00 p.m.");
    expect(describeWeekly(["sun"], "00:15")).toBe("Sundays, 12:15 a.m.");
  });
});

describe("groupVideoLinks", () => {
  const now = "2026-11-20T12:00:00Z";

  it("splits recurring, upcoming (soonest first) and past (latest first)", () => {
    const groups = groupVideoLinks(SAMPLE_VIDEO_LINKS, now);
    expect(groups.recurring.map((l) => l.title)).toEqual(["Weekly stand-up"]);
    expect(groups.upcoming.map((l) => l.title)).toEqual(["Account pages demo", "Milestone 2 review"]);
    expect(groups.past.map((l) => l.title)).toEqual(["Milestone 1 review", "Kick-off with the client", "Team intro call"]);
  });

  it("finds the next meeting, or nothing once every meeting has passed", () => {
    expect(nextMeeting(SAMPLE_VIDEO_LINKS, now)?.title).toBe("Account pages demo");
    expect(nextMeeting(SAMPLE_VIDEO_LINKS, "2027-06-01T00:00:00Z")).toBeUndefined();
  });
});
