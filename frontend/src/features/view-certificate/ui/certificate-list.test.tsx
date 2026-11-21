import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { CertificateList } from "./certificate-list";

vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const CERTS = [
  { id: "c1", filename: "aws.pdf", size_bytes: 10, uploaded_at: null },
  { id: "c2", filename: "scrum.pdf", size_bytes: 12, uploaded_at: null },
];

const fakeApi = (result: ApiResult<Blob>) => ({ getBlob: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => {
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:certificate");
  URL.revokeObjectURL = vi.fn();
});

describe("CertificateList", () => {
  it("opens a certificate's preview in a pop-up, with a close button", async () => {
    const api = fakeApi({ ok: true, data: new Blob(["%PDF-1.7"], { type: "application/pdf" }) });
    const user = userEvent.setup();
    render(<CertificateList accountId={7} certificates={CERTS} api={api} />);
    await user.click(screen.getByRole("button", { name: "scrum.pdf" }));

    const dialog = await screen.findByRole("dialog", { name: "scrum.pdf" });
    await waitFor(() =>
      expect(within(dialog).getByTitle("Preview of scrum.pdf")).toHaveAttribute("src", "blob:certificate"),
    );
    expect(api.getBlob).toHaveBeenCalledWith("/api/developers/7/certificates/c2/file/");
    expect(within(dialog).getByRole("link", { name: "Download" })).toHaveAttribute("download", "scrum.pdf");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:certificate");
  });

  it("says when a certificate can't be opened", async () => {
    const api = fakeApi({ ok: false, error: { code: "NOT_FOUND", message: "We couldn't find that certificate." } });
    render(<CertificateList accountId={7} certificates={CERTS} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "aws.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't find that certificate.");
  });

  it("says when there are none", () => {
    render(<CertificateList accountId={7} certificates={[]} api={fakeApi({ ok: true, data: new Blob() })} />);
    expect(screen.getByText("No certificates added.")).toBeInTheDocument();
  });
});
