import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { getToasts, resetToasts } from "@/shared/lib/toast";

import { AddVideoLinkForm } from "./add-video-link-form";

afterEach(() => resetToasts());

describe("AddVideoLinkForm", () => {
  it("asks for a date for one meeting, and swaps to days and a time when Recurring is picked", async () => {
    const user = userEvent.setup();
    render(<AddVideoLinkForm />);
    expect(screen.getByLabelText(/^Date/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Days/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/repeat every week/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Recurring" }));
    expect(screen.queryByLabelText(/^Date/)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Days/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mon" })).toBeInTheDocument();
    expect(screen.getByText(/repeat every week on the days you pick/)).toBeInTheDocument();
  });

  it("names the time zone, and who can add links", () => {
    render(<AddVideoLinkForm />);
    expect(screen.getByText("In Eastern Time (ET).")).toBeInTheDocument();
    expect(screen.getByText(/Only the client and the Team Lead can add meeting links/)).toBeInTheDocument();
  });

  it("shows each problem on its field and saves nothing", async () => {
    const user = userEvent.setup();
    render(<AddVideoLinkForm />);
    await user.type(screen.getByLabelText(/^Meeting link/), "meet.google.com/abc");
    await user.click(screen.getByRole("radio", { name: "Recurring" }));
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByText("Give the meeting a name.")).toBeInTheDocument();
    expect(screen.getByText("Use a full meeting link starting with https://.")).toBeInTheDocument();
    expect(screen.getByText("Pick at least one day.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-invalid", "true");
    expect(getToasts()).toHaveLength(0);
  });

  it("says adding is under construction once the fields are valid", async () => {
    const user = userEvent.setup();
    render(<AddVideoLinkForm />);
    await user.type(screen.getByLabelText(/^Name/), "Sprint review");
    await user.type(screen.getByLabelText(/^Meeting link/), "https://meet.google.com/abc");
    await user.click(screen.getByRole("radio", { name: "Recurring" }));
    await user.click(screen.getByRole("checkbox", { name: "Thu" }));
    await user.type(screen.getByLabelText(/^Time/), "10:00");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(getToasts().map((t) => t.description)).toEqual(["Add video link: this function is under construction."]);
  });
});
