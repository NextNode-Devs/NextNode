import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_DRAFT, type ProjectDraft } from "../model/draft";
import type { ProjectKind } from "../model/project";
import { ProjectForm, type SaveFailure } from "./project-form";

type Submit = (draft: ProjectDraft) => Promise<SaveFailure | undefined>;

function show(kind: ProjectKind, submit = vi.fn<Submit>(async () => undefined)) {
  render(
    <ProjectForm
      kind={kind}
      initial={EMPTY_DRAFT}
      submit={submit}
      renderTechStack={({ value, onChange, ...aria }) => (
        <input {...aria} value={value.join(",")} onChange={(e) => onChange(e.target.value.split(",").filter(Boolean))} />
      )}
      submitLabel="Publish"
      pendingLabel="Publishing…"
      failureTitle="Not published"
      cancelHref="/dashboard"
    />,
  );
  return submit;
}

async function fill(kind: ProjectKind) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Title/), "Booking app");
  await user.type(screen.getByLabelText(kind === "client" ? /^Scope/ : /^Description/), "A booking app for a yoga studio.");
  await user.type(screen.getByLabelText(/^Tech stack/), "React");
  await user.type(screen.getByLabelText(/^Target delivery date/), "2099-01-01");
  return user;
}

describe("ProjectForm", () => {
  it("asks a client for a proposed budget and sends it", async () => {
    const submit = show("client");
    const user = await fill("client");
    await user.type(screen.getByLabelText(/^Proposed budget/), "2,500");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ budget: "2,500", tech_stack: ["React"] }));
  });

  it("never shows a budget field for a developer idea", () => {
    show("developer");
    expect(screen.queryByLabelText(/budget/i)).not.toBeInTheDocument();
  });

  it("shows errors on the fields and does not submit an incomplete brief", async () => {
    const submit = show("client");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Not published");
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Propose a budget.")).toBeInTheDocument();
  });

  it("refuses a budget under the minimum before sending", async () => {
    const submit = show("client");
    const user = await fill("client");
    await user.type(screen.getByLabelText(/^Proposed budget/), "1000");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("Must be at least CAD 1,500.00.")).toBeInTheDocument();
  });

  it("shows the API's refusal on the field it names", async () => {
    show(
      "client",
      vi.fn<Submit>(async () => ({
        message: "Some details need attention.",
        fields: { title: "Title taken by the API." },
      })),
    );
    const user = await fill("client");
    await user.type(screen.getByLabelText(/^Proposed budget/), "2500");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Title taken by the API.")).toBeInTheDocument();
  });
});
