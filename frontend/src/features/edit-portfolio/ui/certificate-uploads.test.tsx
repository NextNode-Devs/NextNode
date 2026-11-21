import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { CertificateUploads } from "./certificate-uploads";

vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const CERT = { id: "c1", filename: "aws.pdf", size_bytes: 10, uploaded_at: "2026-11-21T10:00:00Z" };

const fakeApi = (result: ApiResult<unknown> = { ok: true, data: CERT }) =>
  ({ postForm: vi.fn(async () => result), delete: vi.fn(async () => result) }) as unknown as BrowserApi;

const pdf = () => new File(["%PDF-1.7"], "aws.pdf", { type: "application/pdf" });

describe("CertificateUploads", () => {
  it("says which formats are eligible", () => {
    render(<CertificateUploads certificates={[]} onChange={vi.fn()} api={fakeApi()} />);
    expect(screen.getByText(/Eligible format: PDF only \(\.pdf\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a PDF certificate")).toHaveAttribute("accept", ".pdf,application/pdf");
  });

  it("uploads a PDF and adds it to the list", async () => {
    const api = fakeApi();
    const onChange = vi.fn();
    render(<CertificateUploads certificates={[]} onChange={onChange} api={api} />);
    await userEvent.setup().upload(screen.getByLabelText("Choose a PDF certificate"), pdf());
    await waitFor(() =>
      expect(api.postForm).toHaveBeenCalledWith("/api/developers/me/certificates/", expect.any(FormData)),
    );
    expect(onChange).toHaveBeenCalledWith([CERT]);
    expect(await screen.findByRole("status")).toHaveTextContent("aws.pdf uploaded.");
  });

  it("refuses anything but a PDF before uploading", async () => {
    const api = fakeApi();
    render(<CertificateUploads certificates={[]} onChange={vi.fn()} api={api} />);
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText("Choose a PDF certificate"), new File(["x"], "cert.docx"));
    expect(screen.getByRole("alert")).toHaveTextContent("Certificates must be PDF files (.pdf).");
    expect(api.postForm).not.toHaveBeenCalled();
  });

  it("removes one", async () => {
    const api = fakeApi();
    const onChange = vi.fn();
    render(<CertificateUploads certificates={[CERT]} onChange={onChange} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove aws.pdf" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/api/developers/me/certificates/c1/"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows the server's refusal on the field", async () => {
    const api = fakeApi({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Check the file.", fields: { file: ["This file isn't a real PDF."] } },
    });
    render(<CertificateUploads certificates={[]} onChange={vi.fn()} api={api} />);
    await userEvent.setup().upload(screen.getByLabelText("Choose a PDF certificate"), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("This file isn't a real PDF.");
  });
});
