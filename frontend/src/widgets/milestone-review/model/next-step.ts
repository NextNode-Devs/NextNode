import type { MilestoneStatus, MilestoneViewer } from "@/entities/milestone";

/** What happens next on a milestone, in words for the person looking at it. */
export function nextStepText(status: MilestoneStatus, viewer: MilestoneViewer): string {
  switch (status) {
    case "pending_deposit":
      return viewer === "client"
        ? "Work starts once you pay the deposit from the project's overview."
        : "Work starts once the client pays the deposit.";
    case "not_started":
      return "Starts when the milestone before it is approved.";
    case "in_progress":
      return viewer === "lead"
        ? "Submit the work when it's ready for the client to review."
        : viewer === "client"
          ? "The team is working on it. You'll be asked to review it when the Team Lead submits it."
          : "The team is working on it. The Team Lead submits it for review.";
    case "under_review":
      return viewer === "client"
        ? "Check the work, then approve it or ask for changes."
        : "Waiting for the client to approve it or ask for changes.";
    case "completed":
      return "Approved by the client.";
  }
}
