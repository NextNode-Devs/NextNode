import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MyTeamCandidacy } from "@/entities/team";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { standingOn } from "../model/standing";
import { ApplyToJoin } from "./apply-to-join";

vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const live = vi.hoisted(() => ({
  listeners: [] as ((frame: { project_id: number }) => void)[],
}));
vi.mock("@/shared/api/realtime", () => ({
  useRealtime: () => ({
    connection: {
      on: (_: string, listener: (frame: { project_id: number }) => void) => {
        live.listeners.push(listener);
        return () => {};
      },
    },
  }),
}));

const item = (overrides: Partial<MyTeamCandidacy>): MyTeamCandidacy => ({
  candidacy_id: "t1",
  project_id: 4,
  project_title: "Booking app",
  kind: "application",
  status: "pending",
  closed_reason: "",
  my_part: "developer",
  lead_name: "Ada",
  developer_name: "Linus",
  conversation_id: "c1",
  created_at: null,
  actions: { accept: false, reject: false, withdraw: true, decline: false },
  ...overrides,
});

function fakeApi(mine: MyTeamCandidacy[], applied?: ApiResult<unknown>): BrowserApi {
  const rows = [...mine];
  return {
    get: vi.fn(async () => ({ ok: true, data: rows })),
    post: vi.fn(async () => {
      if (applied) return applied;
      rows.push(item({ candidacy_id: "t9", conversation_id: "c9" }));
      return { ok: true, data: { id: "t9", conversation_id: "c9" } };
    }),
  } as unknown as BrowserApi;
}

describe("standingOn", () => {
  it("is what's pending here, or an application already made; never a declined invitation", () => {
    const declined = item({ kind: "invitation", status: "declined" });
    expect(standingOn([declined], 4)).toBeUndefined();
    expect(standingOn([item({ project_id: 9 })], 4)).toBeUndefined();
    const withdrawn = item({ status: "withdrawn" });
    expect(standingOn([declined, withdrawn], 4)).toBe(withdrawn);
    expect(standingOn([item({ status: "pending", my_part: "lead" })], 4)).toBeUndefined();
  });
});

describe("ApplyToJoin", () => {
  it("applies and points to the conversation it opened", async () => {
    const api = fakeApi([]);
    render(<ApplyToJoin projectId={4} api={api} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Apply to join" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/projects/4/team/applications/"));
    expect(await screen.findByRole("status")).toHaveTextContent("Application sent");
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/conversations/c9");
  });

  it("follows the Team Lead's decision live", async () => {
    const pending = item({});
    const api = fakeApi([pending]);
    render(<ApplyToJoin projectId={4} api={api} />);
    expect(await screen.findByRole("status")).toHaveTextContent("The Team Lead decides");
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      data: [item({ status: "rejected", closed_reason: "The Team Lead turned down this application" })],
    });
    act(() => {
      for (const listener of live.listeners) listener({ project_id: 4 });
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("turned down"));
  });

  it("points an invited developer to their invitation instead of offering to apply", async () => {
    render(<ApplyToJoin projectId={4} api={fakeApi([item({ kind: "invitation" })])} />);
    expect(await screen.findByRole("status")).toHaveTextContent("invited you");
    expect(screen.queryByRole("button", { name: "Apply to join" })).not.toBeInTheDocument();
  });

  it("says why an application ended, and doesn't offer another", async () => {
    render(
      <ApplyToJoin
        projectId={4}
        api={fakeApi([item({ status: "closed", closed_reason: "The team is full" })])}
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent("The team is full");
    expect(screen.queryByRole("button", { name: "Apply to join" })).not.toBeInTheDocument();
  });

  it("shows the server's reason when it refuses", async () => {
    const refused = { ok: false as const, error: { code: "TEAM_NOT_RECRUITING", message: "Recruitment has closed" } };
    render(<ApplyToJoin projectId={4} api={fakeApi([], refused)} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Apply to join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recruitment has closed");
    expect(screen.getByRole("button", { name: "Apply to join" })).toBeEnabled();
  });
});
