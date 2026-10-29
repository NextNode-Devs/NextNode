export type DepositViewer = {
  /** The signed-in user owns this project as its client. */
  isProjectClient: boolean;
  projectKind: "client" | "developer";
  /** The project's status from the backend (#3/#6). */
  projectStatus: string;
};

/** "Pay deposit" exists only for the client of a client project in `Assigned`. */
export function canPayDeposit(viewer: DepositViewer): boolean {
  return viewer.isProjectClient && viewer.projectKind === "client" && viewer.projectStatus === "Assigned";
}
