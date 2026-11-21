import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ActivityCheck } from "@/entities/team";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { ActivityCheckAlert } from "./activity-check-alert";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const CHECK: ActivityCheck = {
  status: "pending",
  question: "Is this project still active?",
  started_at: "2026-12-01T14:00:00Z",
  answer_by: "2026-12-08T14:00:00Z",
  ended_at: null,
  answered_by: null,
};

const fakeApi = (result: ApiResult<unknown> = { ok: true, data: {} }) =>
  ({ post: vi.fn(async () => result) }) as unknown as BrowserApi;

describe("ActivityCheckAlert", () => {
  it("lets a member confirm the project is still active", async () => {
    const api = fakeApi();
    render(<ActivityCheckAlert projectId={4} check={CHECK} canConfirm isLead={false} api={api} />);
    expect(screen.getByRole("heading", { name: "Is this project still active?" })).toBeInTheDocument();
    expect(screen.getByText(/hidden from the open-projects feed/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Yes, it's still active" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/projects/4/activity-check/confirm/"));
    expect(refresh).toHaveBeenCalled();
  });

  it("explains the situation to the Team Lead", () => {
    render(<ActivityCheckAlert projectId={4} check={CHECK} canConfirm isLead api={fakeApi()} />);
    expect(screen.getByText(/You haven't written in the project chat for 30 days/)).toBeInTheDocument();
  });

  it("has no button for someone who can't answer, and shows refusals", async () => {
    const { rerender } = render(
      <ActivityCheckAlert projectId={4} check={CHECK} canConfirm={false} isLead={false} api={fakeApi()} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const api = fakeApi({ ok: false, error: { code: "CONFLICT", message: "The time to answer has passed." } });
    rerender(<ActivityCheckAlert projectId={4} check={CHECK} canConfirm isLead={false} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Yes, it's still active" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The time to answer has passed.");
  });
});
