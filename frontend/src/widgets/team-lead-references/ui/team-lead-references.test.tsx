import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { sampleReferences } from "@/entities/rating";

import { TeamLeadReferences } from "./team-lead-references";

describe("TeamLeadReferences", () => {
  it("shows what Team Leads wrote, with who and on which project", () => {
    render(<TeamLeadReferences references={sampleReferences(1)} isOwner={false} />);
    expect(screen.getByText(/Owned the booking flow end to end/)).toBeInTheDocument();
    expect(screen.getByText(/Ada, Team Lead on Clinic booking app/)).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("draws the empty state", () => {
    render(<TeamLeadReferences references={[]} isOwner />);
    expect(screen.getByText(/No references yet/)).toBeInTheDocument();
  });
});
