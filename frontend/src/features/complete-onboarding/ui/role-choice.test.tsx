import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RoleChoice } from "./role-choice";

describe("RoleChoice", () => {
  it("is server-rendered disabled, so a click before hydration can't be lost", () => {
    const html = renderToString(<RoleChoice value={null} onChange={vi.fn()} />);
    expect(html.match(/role="radio"[^>]*disabled/g)).toHaveLength(2);
  });

  it("is enabled once React is running in the browser", () => {
    render(<RoleChoice value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /I'm a developer/ })).toBeEnabled();
  });
});
