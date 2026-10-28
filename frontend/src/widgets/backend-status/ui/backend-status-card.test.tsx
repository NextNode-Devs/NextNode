import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BackendStatusCard } from "./backend-status-card";

describe("BackendStatusCard", () => {
  it("announces the loading state", () => {
    render(<BackendStatusCard state="loading" />);
    expect(screen.getByRole("status", { name: "Checking the backend" })).toBeInTheDocument();
  });

  it("shows each health value when the API answers", () => {
    render(
      <BackendStatusCard
        state="ready"
        health={{ status: "ok", database: "ok", auth: "unconfigured" }}
      />,
    );
    expect(screen.getByText("Database").nextElementSibling).toHaveTextContent("ok");
    expect(screen.getByText("Clerk verification").nextElementSibling).toHaveTextContent("unconfigured");
  });

  it("explains how to recover when the API is unreachable", () => {
    render(<BackendStatusCard state="error" message="The API could not be reached." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The API could not be reached.");
    expect(screen.getByRole("alert")).toHaveTextContent("runserver");
  });
});
