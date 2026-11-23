import type { Project } from "@/entities/project";

export type ProjectTab = "overview" | "chat" | "documents" | "meetings" | "updates" | "team" | "payments";

export type TabLink = { tab: ProjectTab; label: string; href: string };

/** A workspace tab's route under `/projects/[id]`. */
export const WORKSPACE_TABS = ["chat", "documents", "meetings", "updates", "team"] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** The client, the Team Lead and members: the people the workspace is for. */
export function isInWorkspace(project: Project): boolean {
  const { is_owner, is_lead, is_member } = project.viewer;
  return is_owner || is_lead || is_member;
}

/**
 * Why someone outside the project can't see its workspace, in words that fit
 * them: only a developer can join a team, so only they are told how to get in.
 * A developer's own idea has no client.
 */
export function workspacePrivacyNote(project: Project, viewerRole: "developer" | "client"): string {
  const client = project.kind === "client";
  const parts = client ? "chat, requirement documents, meetings and updates" : "chat, meetings and updates";
  const note = `This project's workspace (${parts}) is private to its ${client ? "client and team" : "team"}.`;
  return viewerRole === "developer" ? `${note} You'll see it if you join the team.` : note;
}

/**
 * The tabs this viewer gets, in order. Anyone outside the project gets none
 * (the Overview alone, no tab bar). Chat is the team's own conversation, which
 * the client is not part of (#6); requirement documents, team changes (NN-38)
 * and payments exist on client projects only.
 */
export function projectTabs(project: Project): TabLink[] {
  if (!isInWorkspace(project)) return [];
  const base = `/projects/${project.id}`;
  const onTeam = project.viewer.is_lead || project.viewer.is_member;
  const client = project.kind === "client";
  const tabs: (TabLink | false)[] = [
    { tab: "overview", label: "Overview", href: base },
    onTeam && { tab: "chat", label: "Chat", href: `${base}/chat` },
    client && project.viewer.can_read_documents && { tab: "documents", label: "Documents", href: `${base}/documents` },
    { tab: "meetings", label: "Meetings", href: `${base}/meetings` },
    { tab: "updates", label: "Updates", href: `${base}/updates` },
    client && { tab: "team", label: "Team", href: `${base}/team` },
    client && { tab: "payments", label: "Payments", href: `${base}/payments` },
  ];
  return tabs.filter((tab): tab is TabLink => Boolean(tab));
}
