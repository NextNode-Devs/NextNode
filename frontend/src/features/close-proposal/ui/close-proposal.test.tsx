import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { CloseProposal } from "./close-proposal";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const fakeApi = (result: ApiResult<unknown> = { ok: true, data: {} }) =>
  ({ post: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => refresh.mockClear());

describe("CloseProposal", () => {
  it("asks first, then locks the team", async () => {
    const api = fakeApi();
    render(<CloseProposal projectId={4} isClientProject api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close the proposal" }));
    expect(screen.getByText(/can't be reopened/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, close the proposal" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/projects/4/close-proposal/"));
    expect(await screen.findByRole("status")).toHaveTextContent("The team is locked.");
    expect(refresh).toHaveBeenCalled();
  });

  it("can be cancelled", async () => {
    const api = fakeApi();
    render(<CloseProposal projectId={4} isClientProject={false} api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close the proposal" }));
    expect(screen.getByText(/finalise the timeline/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Close the proposal" })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows why the server refused", async () => {
    const api = fakeApi({
      ok: false,
      error: {
        code: "TEAM_NOT_RECRUITING",
        message: "Close the proposal once the team is full; the team has 3 of 5 people.",
      },
    });
    render(<CloseProposal projectId={4} isClientProject api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close the proposal" }));
    await user.click(screen.getByRole("button", { name: "Yes, close the proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("3 of 5 people");
  });
});
