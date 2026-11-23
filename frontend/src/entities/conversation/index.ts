export {
  getConversation,
  listConversations,
  listMessages,
  markRead,
  PAGE_SIZE,
} from "./api/conversations-api";
export {
  isConversationId,
  MESSAGE_MAX,
  nameOf,
  otherParticipant,
  SUBJECT_LABEL,
  type Conversation,
  type Message,
  type Participant,
  type SubjectKind,
} from "./model/conversation";
export {
  FRAME,
  parseClosed,
  parseMessageNew,
  parseOpened,
  parseSendError,
  sendFrame,
  type ConversationClosed,
  type MessageNew,
  type SendError,
} from "./model/frames";
// Phase 2 prototype (NN-32 #88): the dashboard v2 inbox tabs.
export {
  INBOX_TAB_LABEL,
  INBOX_TABS,
  unreadByTab,
  unreadText,
  type InboxItem,
  type InboxTab,
} from "./model/inbox";
// Prototype sample data: import only from Phase 2 prototype screens.
export { sampleInbox } from "./model/sample";
