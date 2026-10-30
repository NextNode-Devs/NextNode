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
