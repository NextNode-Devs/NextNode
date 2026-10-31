import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { RequirementDocuments } from "./requirement-documents";

vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const DOC = { id: "d1", filename: "brief.pdf", type: "pdf", size_bytes: 2048, uploaded_at: null };

function fakeApi(responses: Record<string, ApiResult<unknown>>): BrowserApi {
  const answer = async (path: string) => responses[path] ?? { ok: false, error: { code: "NOT_FOUND", message: "No." } };
  return {
    get: vi.fn(answer),
    post: vi.fn(answer),
    put: vi.fn(answer),
    patch: vi.fn(answer),
    postForm: vi.fn(async () => ({ ok: true, data: { ...DOC, id: "d2", filename: "spec.docx", type: "docx" } })),
  } as unknown as BrowserApi;
}

afterEach(() => vi.unstubAllGlobals());

describe("RequirementDocuments", () => {
  it("lists documents and downloads through a fresh link", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const api = fakeApi({
      "/api/projects/5/documents/": { ok: true, data: [DOC] },
      "/api/projects/5/documents/d1/link/": { ok: true, data: { url: "http://api/files/t/", expires_at: "x" } },
    });
    render(<RequirementDocuments projectId={5} canUpload={false} api={api} />);
    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload document/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Download brief.pdf" }));
    expect(assign).toHaveBeenCalledWith("http://api/files/t/");
  });

  it("shows the empty state, then the uploaded file, for the owning client", async () => {
    const api = fakeApi({ "/api/projects/5/documents/": { ok: true, data: [] } });
    const { container } = render(<RequirementDocuments projectId={5} canUpload api={api} />);
    expect(await screen.findByText(/No documents yet/)).toBeInTheDocument();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.setup().upload(input, new File(["%PDF-1.7"], "spec.docx"));
    expect(await screen.findByText("spec.docx uploaded.")).toBeInTheDocument();
    expect(screen.getByText("spec.docx")).toBeInTheDocument();
  });

  it("refuses an unsupported file before uploading it", async () => {
    const api = fakeApi({ "/api/projects/5/documents/": { ok: true, data: [] } });
    const { container } = render(<RequirementDocuments projectId={5} canUpload api={api} />);
    await screen.findByText(/No documents yet/);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.setup({ applyAccept: false }).upload(input, new File(["hi"], "notes.txt"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload a PDF or DOCX file.");
    expect(api.postForm).not.toHaveBeenCalled();
  });

  it("says when the list couldn't load, with a way to retry", async () => {
    const api = fakeApi({
      "/api/projects/5/documents/": { ok: false, error: { code: "UNREACHABLE", message: "The API could not be reached." } },
    });
    render(<RequirementDocuments projectId={5} canUpload={false} api={api} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load the documents");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
