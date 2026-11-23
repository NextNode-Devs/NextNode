// Phase 2 prototype (NN-26 #90): time-limited, single-use team invitation links.
export {
  DEFAULT_EXPIRY_HOURS,
  describeInviteLink,
  expiresIn,
  INVITE_LINK_EXPIRY_OPTIONS,
  inviteLinkPath,
  STATUS_TAG,
  type InviteLink,
  type InviteLinkStatus,
} from "./model/invite-link";
// Prototype sample data: import only from Phase 2 prototype screens.
export { sampleInviteLinkByToken, sampleInviteLinks, sampleInviteToken } from "./model/sample";
export { InviteLinkStatusBadge } from "./ui/invite-link-status-badge";
