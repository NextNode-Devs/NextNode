import { FileX2Icon, LockIcon, MessagesSquareIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SAMPLE_MILESTONES } from "@/entities/milestone";
import type { Project } from "@/entities/project";
import { SAMPLE_PROJECT_UPDATES } from "@/entities/project-update";
import { getStartGate } from "@/entities/start-gate";
import { SAMPLE_VIDEO_LINKS } from "@/entities/video-link";
import { AddVideoLinkForm } from "@/features/add-video-link";
import { RealtimeProvider } from "@/shared/api/realtime";
import { authedServerApi } from "@/shared/api/server-client";
import { isAuthConfigured } from "@/shared/config/env.public";
import { LoadError } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { ConversationChat } from "@/widgets/conversation-chat";
import { workspacePrivacyNote } from "@/widgets/project-tabs";
import { ProjectUpdatesFeed } from "@/widgets/project-updates";
import { RequirementDocuments } from "@/widgets/requirement-documents";
import { NextMeetingCard, VideoLinksCard } from "@/widgets/video-links";

type TabProps = { project: Project; myAccountId: number };

const overviewLink = (project: Project) => (
  <Button asChild variant="outline">
    <Link href={`/projects/${project.id}`}>Back to the overview</Link>
  </Button>
);

/** Shown to anyone outside the project who opens a workspace link directly. */
export function MembersOnly({ project, viewerRole }: { project: Project; viewerRole: "developer" | "client" }) {
  return (
    <StateCard
      icon={<LockIcon aria-hidden />}
      title={project.kind === "client" ? "Only the client and team can see this" : "Only the team can see this"}
      message={`${workspacePrivacyNote(project, viewerRole)} If someone leaves the team, they lose access; the files stay with the project.`}
      action={overviewLink(project)}
    />
  );
}

/** The team's own conversation (Phase 1, #6), unchanged. The client is not part of it. */
export async function ChatTab({ project, myAccountId }: TabProps) {
  if (!(project.viewer.is_lead || project.viewer.is_member)) {
    return (
      <StateCard
        icon={<LockIcon aria-hidden />}
        title="The chat is for the Team Lead and members"
        message="You can follow the project in Updates, and reach the Team Lead in your existing conversation with them."
        action={overviewLink(project)}
      />
    );
  }
  const gate = await getStartGate(authedServerApi, project.id);
  if (!gate.ok) return <LoadError title="We couldn't load the team chat" message={gate.error.message} />;
  const conversationId = gate.data.workspace_conversation_id;
  if (!conversationId) {
    return (
      <StateCard
        icon={<MessagesSquareIcon aria-hidden />}
        title="The team chat opens when work starts"
        message={gate.data.next_step}
        action={overviewLink(project)}
      />
    );
  }
  const chat = <ConversationChat conversationId={conversationId} myAccountId={myAccountId} embedded />;
  return isAuthConfigured() ? <RealtimeProvider>{chat}</RealtimeProvider> : chat;
}

/** The requirement documents widget (Phase 1, #3), unchanged. */
export function DocumentsTab({ project }: TabProps) {
  if (project.kind !== "client" || !project.viewer.can_read_documents) {
    return (
      <StateCard
        icon={<FileX2Icon aria-hidden />}
        title="No requirement documents here"
        message="Requirement documents belong to client projects. Share files for this project in the team chat."
        action={overviewLink(project)}
      />
    );
  }
  return <RequirementDocuments projectId={project.id} canUpload={project.viewer.can_upload_documents} />;
}

function WithAside({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">{main}</div>
      <aside className="space-y-4">{aside}</aside>
    </div>
  );
}

const SAMPLE_NOTICE = "This tab shows sample meetings and posts, not this project's. Adding and posting are under construction and save nothing.";

/** Prototype (#92): sample meetings; the client and the Team Lead add them (Team Lead decision, 20 Nov). */
export function MeetingsTab({ project, now }: TabProps & { now: string }) {
  const { is_owner, is_lead } = project.viewer;
  return (
    <div className="space-y-6">
      <PrototypeNotice>{SAMPLE_NOTICE}</PrototypeNotice>
      <WithAside
        main={<VideoLinksCard links={SAMPLE_VIDEO_LINKS} now={now} />}
        aside={
          is_owner || is_lead ? (
            <AddVideoLinkForm />
          ) : (
            <p className="text-sm text-muted-foreground">The client and the Team Lead add meeting links.</p>
          )
        }
      />
    </div>
  );
}

/** Prototype (#92): sample posts grouped by sample milestones, and the next sample meeting. */
export function UpdatesTab({ project, now }: TabProps & { now: string }) {
  const onTeam = project.viewer.is_lead || project.viewer.is_member;
  return (
    <div className="space-y-6">
      <PrototypeNotice>{SAMPLE_NOTICE}</PrototypeNotice>
      <WithAside
        main={
          <ProjectUpdatesFeed
            updates={SAMPLE_PROJECT_UPDATES}
            milestones={SAMPLE_MILESTONES}
            chatHref={onTeam ? `/projects/${project.id}/chat` : null}
          />
        }
        aside={<NextMeetingCard links={SAMPLE_VIDEO_LINKS} now={now} allLinksHref={`/projects/${project.id}/meetings`} />}
      />
    </div>
  );
}
