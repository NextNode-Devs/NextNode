import { describe, expect, it } from "vitest";

import { unreadByTab } from "@/entities/conversation";
import { SAMPLE_PROJECT_UPDATES } from "@/entities/project-update";

import { byRole, latestUpdateFor, loadSampleOverview, roleOptions } from "./overview";

const developer = loadSampleOverview("developer");
const client = loadSampleOverview("client");
if (!developer.ok || !client.ok) throw new Error("sample overview should load");

describe("roleOptions", () => {
  it("lists only the roles the viewer holds, in order, with how many projects", () => {
    expect(roleOptions(developer.data.projects)).toEqual([
      { role: "lead", count: 2 },
      { role: "assistant_lead", count: 1 },
      { role: "member", count: 2 },
    ]);
    expect(roleOptions(client.data.projects)).toEqual([{ role: "client", count: 3 }]);
  });
});

describe("byRole", () => {
  it("keeps everything for All, and only that role otherwise", () => {
    const { attention } = developer.data;
    expect(byRole(attention, "all")).toHaveLength(attention.length);
    expect(byRole(attention, "assistant_lead").map((a) => a.project_title)).toEqual(["Campus marketplace"]);
  });

  it("shows an item with no role (an invitation) under All only", () => {
    const invitation = developer.data.attention.find((a) => a.role === null);
    expect(invitation).toBeDefined();
    for (const role of ["lead", "assistant_lead", "member"] as const) {
      expect(byRole(developer.data.attention, role)).not.toContain(invitation);
    }
  });
});

describe("latestUpdateFor", () => {
  it("gives the newest update on that project only", () => {
    expect(latestUpdateFor(9001, SAMPLE_PROJECT_UPDATES)?.id).toBe(7);
    expect(latestUpdateFor(9002, SAMPLE_PROJECT_UPDATES)).toBeUndefined();
  });
});

describe("sample inbox", () => {
  it("counts unread messages per tab, and gives clients no team chats", () => {
    expect(unreadByTab(developer.data.inbox)).toEqual({ team: 6, messages: 1, applications: 2 });
    expect(client.data.inbox.some((item) => item.tab === "team")).toBe(false);
  });
});
