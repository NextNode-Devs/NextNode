import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactSupportButton } from "./contact-support-button";

describe("ContactSupportButton", () => {
  it("opens the prototype support dialog and returns focus when closed with Esc", async () => {
    const user = userEvent.setup();
    render(<ContactSupportButton />);
    const trigger = screen.getByRole("button", { name: "Contact support" });

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Contact support" });
    expect(dialog).toHaveAccessibleDescription(/NextNode is a prototype/);
    expect(dialog).toHaveTextContent("Team Lead first");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("closes from the Got it button", async () => {
    const user = userEvent.setup();
    render(<ContactSupportButton />);
    await user.click(screen.getByRole("button", { name: "Contact support" }));
    await user.click(await screen.findByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("compact variant keeps an accessible name on phones", () => {
    render(<ContactSupportButton variant="compact" />);
    expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
  });
});
