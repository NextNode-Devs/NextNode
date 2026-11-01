import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { SetTeamSize } from "./set-team-size";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const fakeApi = (result: ApiResult<unknown> = { ok: true, data: {} }) =>
  ({ put: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => refresh.mockClear());

describe("SetTeamSize", () => {
  it("asks for a size before sending anything", async () => {
    const api = fakeApi();
    render(<SetTeamSize projectId={4} size={null} headcount={1} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open the spots" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a team size.");
    expect(api.put).not.toHaveBeenCalled();
  });

  it("saves the chosen total and refreshes the page", async () => {
    const api = fakeApi();
    render(<SetTeamSize projectId={4} size={null} headcount={1} api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "Open the spots" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/api/projects/4/team/size/", { size: 6 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Team size saved.");
    expect(refresh).toHaveBeenCalled();
  });

  it("doesn't offer a size smaller than the people already on the team", () => {
    render(<SetTeamSize projectId={4} size={7} headcount={6} api={fakeApi()} />);
    expect(screen.getByRole("radio", { name: "5" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "6" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "7" })).toBeChecked();
  });

  it("shows the server's reason when it refuses", async () => {
    const api = fakeApi({ ok: false, error: { code: "TEAM_NOT_RECRUITING", message: "Recruitment has closed" } });
    render(<SetTeamSize projectId={4} size={5} headcount={1} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save size" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recruitment has closed");
    expect(refresh).not.toHaveBeenCalled();
  });
});
