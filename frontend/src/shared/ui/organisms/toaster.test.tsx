import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetToasts, toast, underConstruction } from "@/shared/lib/toast";

import { Toaster } from "./toaster";

afterEach(() => {
  act(() => resetToasts());
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("renders nothing visible until a toast is queued, inside a polite live region", () => {
    render(<Toaster />);
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the under-construction message", () => {
    render(<Toaster />);
    act(() => {
      underConstruction("Release payment");
    });
    const item = screen.getByRole("status");
    expect(item).toHaveTextContent("This is a prototype");
    expect(item).toHaveTextContent("Release payment: this function is under construction.");
  });

  it("uses role=alert for errors", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Upload failed", tone: "error" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
  });

  it("closes from the dismiss button", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast({ title: "Hello", duration: 0 });
    });
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.queryByText("Hello")).not.toBeInTheDocument());
  });

  it("closes itself after its duration", async () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Brief", duration: 1000 });
    });
    expect(screen.getByText("Brief")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByText("Brief")).not.toBeInTheDocument());
  });
});
