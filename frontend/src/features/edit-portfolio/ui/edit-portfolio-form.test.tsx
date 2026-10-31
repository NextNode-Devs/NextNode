import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Portfolio } from "@/entities/developer";

import type { SaveFailure } from "../api/save-portfolio";
import type { PortfolioDraft } from "../model/draft";
import { EditPortfolioForm } from "./edit-portfolio-form";

vi.mock("../api/save-portfolio", () => ({ savePortfolio: vi.fn() }));
// Skill suggestions call the API through the browser client; no Clerk session in tests.
vi.mock("@/shared/api/browser-client", () => ({
  useApiClient: () => ({ get: async () => ({ ok: true, data: [] }) }),
}));

const PORTFOLIO: Portfolio = {
  account_id: 7,
  display_name: "Ada",
  headline: "Backend developer",
  bio: "",
  github_username: "ada",
  github_url: "https://github.com/ada",
  skills: [{ key: "python", label: "Python" }],
  projects: [{ title: "Engine", repository_url: "https://github.com/ada/engine", demo_url: null }],
  resume_url: null,
  is_available: false,
  is_owner: true,
};

type Save = (draft: PortfolioDraft) => Promise<SaveFailure>;

/** The message shown under a field, found through the field's own aria-describedby. */
function errorOn(field: HTMLElement): string {
  expect(field).toHaveAttribute("aria-invalid", "true");
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  const error = ids.map((id) => document.getElementById(id)).find((el) => el?.id.endsWith("-error"));
  return error?.textContent ?? "";
}

describe("EditPortfolioForm", () => {
  it("starts from the saved portfolio", () => {
    render(<EditPortfolioForm portfolio={PORTFOLIO} save={vi.fn()} />);
    expect(screen.getByLabelText(/Headline/)).toHaveValue("Backend developer");
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Engine");
    expect(screen.getByRole("list", { name: "Added skills" })).toHaveTextContent("Python");
    expect(screen.getByLabelText("Available for work")).not.toBeChecked();
  });

  it("puts each mistake on its own field, with a summary, and doesn't save", async () => {
    const user = userEvent.setup();
    const save = vi.fn<Save>();
    render(<EditPortfolioForm portfolio={PORTFOLIO} save={save} />);

    await user.clear(screen.getByLabelText(/Headline/));
    await user.type(screen.getByLabelText(/Resume link/), "example.com/cv");
    await user.click(screen.getByRole("button", { name: "Save portfolio" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Your portfolio wasn't saved");
    expect(errorOn(screen.getByLabelText(/Headline/))).toBe("Enter your headline.");
    expect(errorOn(screen.getByLabelText(/Resume link/))).toMatch(/starting with https:\/\//);
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-invalid", "false");
  });

  it("shows the API's own message on the project field it names", async () => {
    const user = userEvent.setup();
    const save = vi.fn<Save>(async () => ({
      code: "VALIDATION_ERROR",
      message: "Some details need attention. Check the highlighted fields.",
      fields: { "projects.1.repository_url": "Enter a full link starting with https://, e.g. https://example.com." },
    }));
    render(<EditPortfolioForm portfolio={PORTFOLIO} save={save} />);

    await user.click(screen.getByRole("button", { name: "Add a project" }));
    const titles = screen.getAllByLabelText(/^Title/);
    await user.type(titles[1], "Notes");
    await user.type(screen.getAllByLabelText(/^Repository link/)[1], "https://notes.example.com");
    await user.click(screen.getByRole("button", { name: "Save portfolio" }));

    const second = screen.getAllByLabelText(/^Repository link/)[1];
    expect(errorOn(second)).toMatch(/full link/);
    expect(screen.getAllByLabelText(/^Repository link/)[0]).toHaveAttribute("aria-invalid", "false");

    await user.type(second, "/x"); // editing a field clears its error
    expect(second).toHaveAttribute("aria-invalid", "false");
  });

  it("saves every field, with blank optional links as empty", async () => {
    const user = userEvent.setup();
    const save = vi.fn<Save>(async () => ({ code: "", message: "", fields: {} }));
    render(<EditPortfolioForm portfolio={PORTFOLIO} save={save} />);

    await user.click(screen.getByLabelText("Available for work"));
    await user.type(screen.getByLabelText(/Live demo link/), "https://engine.example.com");
    await user.click(screen.getByRole("button", { name: "Save portfolio" }));

    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({
      headline: "Backend developer",
      is_available: true,
      skills: ["Python"],
      projects: [{ title: "Engine", demo_url: "https://engine.example.com" }],
      resume_url: "",
    });
  });

  it("allows at most six projects and says why the button stopped", async () => {
    const user = userEvent.setup();
    render(<EditPortfolioForm portfolio={PORTFOLIO} save={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add a project" });
    for (let i = 0; i < 5; i++) await user.click(add);
    expect(add).toBeDisabled();
    expect(screen.getByText(/That's the most you can add \(6\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Engine" }));
    expect(add).toBeEnabled();
  });
});
