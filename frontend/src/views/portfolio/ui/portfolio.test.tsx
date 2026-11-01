import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { PortfolioProfile, type Portfolio } from "@/entities/developer";

import { actionsFor, PortfolioActions } from "./portfolio-actions";

const PORTFOLIO: Portfolio = {
  account_id: 7,
  display_name: "Ada Lovelace",
  headline: "Full-stack developer",
  bio: "I build things.",
  github_username: "ada",
  github_url: "https://github.com/ada",
  skills: [{ key: "react", label: "React" }],
  projects: [
    { title: "Engine", repository_url: "https://github.com/ada/engine", demo_url: "https://engine.example.com" },
    { title: "Notes", repository_url: "https://github.com/ada/notes", demo_url: null },
  ],
  resume_url: "https://example.com/cv.pdf",
  is_available: true,
  is_owner: false,
};

describe("PortfolioProfile", () => {
  it("shows every part of the portfolio, with links opening safely in a new tab", () => {
    render(<PortfolioProfile portfolio={PORTFOLIO} />);
    expect(screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("Available for work")).toBeInTheDocument();
    const repos = screen.getAllByRole("link", { name: /Repository/ });
    expect(repos.map((a) => a.getAttribute("href"))).toEqual([
      "https://github.com/ada/engine",
      "https://github.com/ada/notes",
    ]);
    expect(screen.getAllByRole("link", { name: /Live demo/ })).toHaveLength(1);
    const github = screen.getByRole("link", { name: /GitHub: ada/ });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: /Resume/ })).toHaveAttribute("href", "https://example.com/cv.pdf");
  });

  it("never says verified", () => {
    const { container } = render(<PortfolioProfile portfolio={PORTFOLIO} />);
    expect(container.textContent?.toLowerCase()).not.toContain("verified");
  });

  it("never turns a non-web link into something clickable", () => {
    render(<PortfolioProfile portfolio={{ ...PORTFOLIO, resume_url: "javascript:alert(1)" }} />);
    expect(screen.queryByRole("link", { name: /Resume/ })).not.toBeInTheDocument();
  });

  it("says plainly what a new portfolio doesn't have yet", () => {
    const empty = { ...PORTFOLIO, bio: "", projects: [], github_url: null, github_username: null, resume_url: null };
    render(<PortfolioProfile portfolio={{ ...empty, is_available: false }} />);
    expect(screen.getByText("No bio yet.")).toBeInTheDocument();
    expect(screen.getByText("No projects added yet.")).toBeInTheDocument();
    expect(screen.getByText("No GitHub profile or resume added.")).toBeInTheDocument();
    expect(screen.queryByText("Available for work")).not.toBeInTheDocument();
  });
});

describe("PortfolioActions (the slot #4 and #5 fill)", () => {
  it("is never shown to the portfolio's owner", () => {
    const { container } = render(<PortfolioActions portfolio={{ ...PORTFOLIO, is_owner: true }} viewerRole="client" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers clients #4's invite to lead; developers get nothing until #5", () => {
    const [invite] = actionsFor(PORTFOLIO, "client") as ReactElement<{ developerId: number }>[];
    expect(invite.key).toBe("invite-to-lead");
    expect(invite.props.developerId).toBe(7);
    expect(actionsFor(PORTFOLIO, "developer")).toEqual([]);
    const { container } = render(<PortfolioActions portfolio={PORTFOLIO} viewerRole="developer" />);
    expect(container).toBeEmptyDOMElement();
  });
});
