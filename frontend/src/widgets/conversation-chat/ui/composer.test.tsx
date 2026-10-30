import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MESSAGE_MAX } from "@/entities/conversation";

import { Composer } from "./composer";

const box = () => screen.getByRole("textbox", { name: "Message" });
const sendButton = () => screen.getByRole("button", { name: "Send message" });

describe("Composer", () => {
  it("sends trimmed text on Enter and clears the box", () => {
    const onSend = vi.fn();
    render(<Composer unavailable={null} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: "  Hello Grace  " } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Hello Grace");
    expect(box()).toHaveValue("");
  });

  it("Shift+Enter does not send", () => {
    const onSend = vi.fn();
    render(<Composer unavailable={null} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: "line one" } });
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("can't send a blank message", () => {
    const onSend = vi.fn();
    render(<Composer unavailable={null} onSend={onSend} />);
    fireEvent.change(box(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("says why sending is unavailable and refuses to send", () => {
    const onSend = vi.fn();
    render(<Composer unavailable="Connecting to live chat…" onSend={onSend} />);
    fireEvent.change(box(), { target: { value: "hi" } });
    expect(screen.getByRole("status")).toHaveTextContent("Connecting to live chat…");
    expect(sendButton()).toBeDisabled();
  });

  it("shows a counter near the limit and caps the length", () => {
    render(<Composer unavailable={null} onSend={vi.fn()} />);
    expect(box()).toHaveAttribute("maxLength", String(MESSAGE_MAX));
    fireEvent.change(box(), { target: { value: "x".repeat(3600) } });
    expect(screen.getByText("3,600 / 4,000")).toBeInTheDocument();
  });
});
