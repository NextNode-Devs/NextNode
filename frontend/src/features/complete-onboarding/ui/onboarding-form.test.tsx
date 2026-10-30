import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OnboardingState } from "../model/onboarding-state";
import { OnboardingForm } from "./onboarding-form";

vi.mock("../api/complete-onboarding", () => ({ completeOnboarding: vi.fn() }));
// Skill suggestions call the API through the browser client; no Clerk session in tests.
vi.mock("@/shared/api/browser-client", () => ({
  useApiClient: () => ({ get: async () => ({ ok: true, data: [] }) }),
}));

describe("OnboardingForm", () => {
  it("asks for a role first and shows only the matching fields", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm action={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create my account" })).toBeDisabled();
    expect(screen.queryByLabelText(/Company name/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /I'm a client/ }));
    expect(screen.getByLabelText(/Company name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Headline/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /I'm a developer/ }));
    expect(screen.getByLabelText(/Headline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub username/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company name/)).not.toBeInTheDocument();
  });

  it("submits typed skills and prefills the display name", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(previous: OnboardingState, form: FormData) => Promise<OnboardingState>>(
      async () => null,
    );
    render(<OnboardingForm defaultDisplayName="Ada Lovelace" action={action} />);

    await user.click(screen.getByRole("radio", { name: /I'm a developer/ }));
    expect(screen.getByLabelText(/Display name/)).toHaveValue("Ada Lovelace");
    await user.type(screen.getByLabelText(/Headline/), "Backend developer");
    await user.type(screen.getByLabelText(/^Skills/), "Django{Enter}react,");
    await user.click(screen.getByRole("button", { name: "Create my account" }));

    const form = action.mock.calls[0][1];
    expect(form.get("role")).toBe("developer");
    expect(form.getAll("skills")).toEqual(["Django", "react"]);
  });

  it("refuses a duplicate skill while typing", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm action={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /I'm a developer/ }));
    await user.type(screen.getByLabelText(/^Skills/), "React{Enter}REACT{Enter}");
    expect(screen.getByText('"REACT" is already added.')).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
  });

  it("shows server errors on the field and in the summary", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (): Promise<OnboardingState> => ({
        code: "VALIDATION_ERROR",
        message: "Some details need attention. Check the highlighted fields.",
        fields: { company_name: "Enter your company name." },
        values: { role: "client", display_name: "Grace", company_name: "", industry: "Retail" },
      }),
    );
    render(<OnboardingForm action={action} />);
    await user.click(screen.getByRole("radio", { name: /I'm a client/ }));
    await user.click(screen.getByRole("button", { name: "Create my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Check the highlighted fields");
    const company = screen.getByLabelText(/Company name/);
    expect(company).toHaveAttribute("aria-invalid", "true");
    expect(company).toHaveAccessibleDescription(/Enter your company name/);
  });

  it("still submits the chosen role after a failed submit resets the form", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(previous: OnboardingState, form: FormData) => Promise<OnboardingState>>(async () => ({
      code: "VALIDATION_ERROR",
      message: "Some details need attention.",
      fields: { company_name: "Enter your company name." },
      values: { role: "client" },
    }));
    render(<OnboardingForm action={action} />);
    await user.click(screen.getByRole("radio", { name: /I'm a client/ }));
    await user.click(screen.getByRole("button", { name: "Create my account" }));
    await screen.findByRole("alert");
    await user.type(screen.getByLabelText(/Company name/), "Acme");
    await user.click(screen.getByRole("button", { name: "Create my account" }));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1][1].get("role")).toBe("client");
  });

  it("links to the dashboard when the account already exists", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (): Promise<OnboardingState> => ({
        code: "ALREADY_ONBOARDED",
        message: "Your account is already set up as a client. The role can't be changed.",
        fields: {},
        values: { role: "developer" },
      }),
    );
    render(<OnboardingForm action={action} />);
    await user.click(screen.getByRole("radio", { name: /I'm a client/ }));
    await user.click(screen.getByRole("button", { name: "Create my account" }));
    expect(await screen.findByRole("link", { name: "Go to your dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
