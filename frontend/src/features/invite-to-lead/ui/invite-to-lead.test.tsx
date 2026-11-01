import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MyProject, ProjectCardData } from "@/entities/project";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { invitableProjects } from "../model/invitable-projects";
import { InviteToLead } from "./invite-to-lead";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const card = (id: number, title: string, overrides: Partial<ProjectCardData> = {}): ProjectCardData => ({
  id,
  kind: "client",
  status: "Posted",
  title,
  tech_stack: [],
  target_delivery_date: "2027-01-01",
  owner: { account_id: 1, display_name: "Grace" },
  lead: null,
  needs_lead: true,
  open_spots: 0,
  created_at: null,
  ...overrides,
});

const mine = (...projects: ProjectCardData[]): MyProject[] => projects.map((project) => ({ project, my_role: "owner" }));

function fakeApi(projects: ApiResult<MyProject[]>, invite?: ApiResult<unknown>): BrowserApi {
  return {
    get: vi.fn(async () => projects),
    post: vi.fn(async () => invite ?? { ok: true, data: { id: "l9", conversation_id: "c9" } }),
  } as unknown as BrowserApi;
}

beforeEach(() => push.mockClear());

describe("invitableProjects", () => {
  it("keeps only the client's own projects that still need a Team Lead", () => {
    const list: MyProject[] = [
      { project: card(1, "Shop rebuild"), my_role: "owner" },
      { project: card(2, "Has a lead", { needs_lead: false }), my_role: "owner" },
      { project: card(3, "Not mine"), my_role: "member" },
    ];
    expect(invitableProjects(list).map((p) => p.id)).toEqual([1]);
  });
});

describe("InviteToLead", () => {
  it("shows nothing when the client has no project needing a Team Lead", async () => {
    const api = fakeApi({ ok: true, data: mine(card(2, "Has a lead", { needs_lead: false })) });
    const { container } = render(<InviteToLead developerId={7} developerName="Ada" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/projects/mine/"));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing if the projects can't be loaded", async () => {
    const api = fakeApi({ ok: false, error: { code: "UNREACHABLE", message: "Offline" } });
    const { container } = render(<InviteToLead developerId={7} developerName="Ada" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("invites to the only open project and opens its page at the new conversation", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ ok: true, data: mine(card(4, "Shop rebuild")) });
    render(<InviteToLead developerId={7} developerName="Ada" api={api} />);
    await user.click(await screen.findByRole("button", { name: /Invite to lead/ }));
    expect(screen.getByRole("radio", { name: "Shop rebuild" })).toBeChecked();
    await user.type(screen.getByLabelText(/Note/), "  Loved your engine project.  ");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(api.post).toHaveBeenCalledWith("/api/projects/4/lead-invitations/", {
      developer_account_id: 7,
      note: "Loved your engine project.",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/4?chat=l9#hiring"));
  });

  it("asks which project when there are several", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ ok: true, data: mine(card(4, "Shop rebuild"), card(5, "Mobile app")) });
    render(<InviteToLead developerId={7} developerName="Ada" api={api} />);
    await user.click(await screen.findByRole("button", { name: /Invite to lead/ }));
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the project");
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Mobile app" }));
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(api.post).toHaveBeenCalledWith("/api/projects/5/lead-invitations/", expect.anything());
  });

  it("shows the server's reason, e.g. an invitation already sent", async () => {
    const user = userEvent.setup();
    const message = "This developer already has an open application or invitation here.";
    const api = fakeApi({ ok: true, data: mine(card(4, "Shop rebuild")) }, { ok: false, error: { code: "CONFLICT", message } });
    render(<InviteToLead developerId={7} developerName="Ada" api={api} />);
    await user.click(await screen.findByRole("button", { name: /Invite to lead/ }));
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeEnabled();
  });
});
