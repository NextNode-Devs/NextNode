import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { sampleShippedProjects } from "@/entities/developer";

import { ShippedProjects } from "./shipped-projects";

describe("ShippedProjects", () => {
  it("lists shipped projects but never a confidential one", () => {
    render(<ShippedProjects projects={sampleShippedProjects(1)} isOwner={false} />);
    expect(screen.getByRole("heading", { name: "Clinic booking app" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Food bank tracker" })).toBeInTheDocument();
    expect(screen.queryByText("Internal payroll dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText(/confidential project/)).not.toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("tells only the owner how many confidential projects are kept off", () => {
    render(<ShippedProjects projects={sampleShippedProjects(1)} isOwner />);
    expect(screen.getByText(/1 confidential project is kept off your portfolio/)).toBeInTheDocument();
  });

  it("draws the empty state", () => {
    render(<ShippedProjects projects={[]} isOwner />);
    expect(screen.getByText(/No shipped projects yet. They appear here/)).toBeInTheDocument();
  });
});
