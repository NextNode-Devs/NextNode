import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { ChooseAssistantLead } from "./choose-assistant-lead";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const MEMBERS = [
  { account_id: 7, display_name: "Linus" },
  { account_id: 8, display_name: "Grace" },
];

const fakeApi = (result: ApiResult<unknown> = { ok: true, data: {} }) =>
  ({ put: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => refresh.mockClear());

describe("ChooseAssistantLead", () => {
  it("asks for a member before sending anything", async () => {
    const api = fakeApi();
    render(<ChooseAssistantLead projectId={4} members={MEMBERS} current={null} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save Assistant Lead" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a member.");
    expect(api.put).not.toHaveBeenCalled();
  });

  it("saves the chosen member and refreshes the page", async () => {
    const api = fakeApi();
    render(<ChooseAssistantLead projectId={4} members={MEMBERS} current={null} api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Grace" }));
    await user.click(screen.getByRole("button", { name: "Save Assistant Lead" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/api/projects/4/assistant-lead/", { account_id: 8 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Assistant Lead saved.");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's refusal", async () => {
    const api = fakeApi({ ok: false, error: { code: "FORBIDDEN", message: "Only this team's Team Lead can." } });
    render(<ChooseAssistantLead projectId={4} members={MEMBERS} current={7} api={api} />);
    const user = userEvent.setup();
    expect(screen.getByRole("group", { name: "Change the Assistant Lead" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Grace" }));
    await user.click(screen.getByRole("button", { name: "Save Assistant Lead" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only this team's Team Lead can.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
