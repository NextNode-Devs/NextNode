/** Mirrors `/api/conversations/` (#4). Ids are UUID strings; message ids are numbers. */
export type SubjectKind = "lead_application" | "lead_invitation" | "team_candidacy" | "dev_test";

export type Participant = { account_id: number; display_name: string };

export type Message = {
  id: number;
  conversation_id: string;
  author_id: number;
  body: string;
  created_at: string | null;
};

export type Conversation = {
  id: string;
  subject_kind: SubjectKind;
  subject_id: string;
  status: "open" | "closed";
  close_reason: string | null;
  created_at: string | null;
  closed_at: string | null;
  participants: Participant[];
  last_message: Message | null;
  unread_count: number;
};

/** Same limit as the backend (`MESSAGE_MAX`). */
export const MESSAGE_MAX = 4000;

export const SUBJECT_LABEL: Record<SubjectKind, string> = {
  lead_application: "Application to lead",
  lead_invitation: "Invitation to lead",
  team_candidacy: "Joining a team",
  dev_test: "Test conversation (development)",
};

/** The person on the other side, as the viewer sees the conversation. */
export function otherParticipant(conversation: Conversation, myAccountId: number): Participant {
  return (
    conversation.participants.find((p) => p.account_id !== myAccountId) ??
    conversation.participants[0] ?? { account_id: 0, display_name: "Unknown" }
  );
}

export function nameOf(conversation: Conversation, accountId: number): string {
  return conversation.participants.find((p) => p.account_id === accountId)?.display_name ?? "Former member";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isConversationId(value: string): boolean {
  return UUID.test(value);
}
