import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MyProject, ProjectCardData } from "@/entities/project";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { invitableTeams } from "../model/invitable-teams";
import { InviteToTeam } from "./invite-to-team";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const card = (id: number, overrides: Partial<ProjectCardData> = {}): ProjectCardData => ({
  id,
  kind: "developer",
  status: "Posted",
  title: `Project ${id}`,
  tech_stack: [],
  target_delivery_date: "2027-01-01",
  owner: { account_id: 1, display_name: "Ada" },
  lead: { account_id: 1, display_name: "Ada" },
  needs_lead: false,
  open_spots: 2,
  created_at: null,
  ...overrides,
});

const led = (project: ProjectCardData, my_role: MyProject["my_role"] = "owner"): MyProject => ({ project, my_role });

function fakeApi(mine: ApiResult<MyProject[]>, invited?: ApiResult<unknown>): BrowserApi {
  return {
    get: vi.fn(async () => mine),
    post: vi.fn(async () => invited ?? { ok: true, data: { id: "t9", conversation_id: "c9" } }),
  } as unknown as BrowserApi;
}

beforeEach(() => push.mockClear());

describe("invitableTeams", () => {
  it("is what the viewer leads with open spots, and never a team this developer leads", () => {
    const full = card(1, { open_spots: 0 });
    const member = card(2);
    const hired = card(3, { kind: "client", owner: { account_id: 9, display_name: "Grace" } });
    const theirs = card(4, { lead: { account_id: 7, display_name: "Linus" } });
    const result = invitableTeams([led(full), led(member, "member"), led(hired, "lead"), led(theirs)], 7);
    expect(result.map((p) => p.id)).toEqual([3]);
  });
});

describe("InviteToTeam", () => {
  it("shows nothing unless the viewer leads a team with open spots", async () => {
    const api = fakeApi({ ok: true, data: [] });
    const { container } = render(<InviteToTeam developerId={7} developerName="Linus" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the projects can't be loaded", async () => {
    const api = fakeApi({ ok: false, error: { code: "UNREACHABLE", message: "No." } });
    const { container } = render(<InviteToTeam developerId={7} developerName="Linus" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("invites to the only team and opens the conversation", async () => {
    const api = fakeApi({ ok: true, data: [led(card(4))] });
    render(<InviteToTeam developerId={7} developerName="Linus" api={api} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Invite to my team/ }));
    expect(screen.getByRole("radio", { name: /Project 4/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/projects/4/team/invitations/", { developer_account_id: 7 }),
    );
    expect(push).toHaveBeenCalledWith("/conversations/c9");
  });

  it("asks which team when there are several, and shows the server's refusal", async () => {
    const refused = { ok: false as const, error: { code: "DUPLICATE_CANDIDACY", message: "You have already invited this developer." } };
    const api = fakeApi({ ok: true, data: [led(card(4)), led(card(5))] }, refused);
    render(<InviteToTeam developerId={7} developerName="Linus" api={api} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Invite to my team/ }));
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the team");
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: /Project 5/ }));
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already invited");
    expect(push).not.toHaveBeenCalled();
  });
});
