export {
  acceptOffer,
  closeProposal,
  declineOffer,
  finalizeTimeline,
  getStartGate,
  previewDeposit,
  sendOffer,
} from "./api/start-gate-api";
export {
  nextActorLabel,
  OFFER_LIMITS,
  OFFER_STATUS_LABEL,
  type DepositPreview,
  type GateAction,
  type GateCondition,
  type NextActor,
  type Offer,
  type OfferBody,
  type OfferStatus,
  type StartGate,
  type ViewerRole,
} from "./model/start-gate";
export { AgreementNote } from "./ui/agreement-note";
export { OfferDetails } from "./ui/offer-details";
