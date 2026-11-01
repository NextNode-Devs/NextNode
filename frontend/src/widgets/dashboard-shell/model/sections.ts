import type { Role } from "@/entities/viewer";

export type SectionId = "my-projects" | "applications" | "invitations" | "conversations" | "portfolio";

export type SectionSpec = {
  id: SectionId;
  title: string;
  /** What will appear here, said plainly while the section is empty. */
  empty: string;
  /** The issue that fills the section. */
  filledBy: string;
};

/**
 * Role-aware sections. Developers see invitations; clients don't (they invite
 * a Team Lead from a portfolio, #4). Order follows each role's primary task.
 */
export const SECTIONS: Record<Role, SectionSpec[]> = {
  developer: [
    {
      id: "invitations",
      title: "Invitations",
      empty: "Invitations to lead a project or join a team will appear here.",
      filledBy: "#4, #5",
    },
    {
      id: "applications",
      title: "Applications",
      empty: "Projects you apply to lead, and teams you ask to join, will appear here with their status.",
      filledBy: "#4, #5",
    },
    {
      id: "my-projects",
      title: "My projects",
      empty: "Your project ideas, and projects you lead or have joined, will appear here.",
      filledBy: "#3",
    },
    {
      id: "conversations",
      title: "Conversations",
      empty: "Hiring and team conversations will appear here, with unread counts.",
      filledBy: "#4",
    },
    {
      id: "portfolio",
      title: "Your portfolio",
      empty: "Your portfolio, as clients see it in the developer directory.",
      filledBy: "#2",
    },
  ],
  client: [
    {
      id: "my-projects",
      title: "My projects",
      empty: "Projects you post will appear here, with their status and Team Lead.",
      filledBy: "#3",
    },
    {
      id: "applications",
      title: "Applications",
      empty: "Developers applying to lead your projects will appear here.",
      filledBy: "#4",
    },
    {
      id: "conversations",
      title: "Conversations",
      empty: "Conversations with Team Lead candidates will appear here, with unread counts.",
      filledBy: "#4",
    },
    {
      id: "portfolio",
      title: "Find developers",
      empty: "Browse developers by skill and open their portfolios.",
      filledBy: "#2",
    },
  ],
};
