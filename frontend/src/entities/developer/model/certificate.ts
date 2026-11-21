/** Mirrors `GET /api/developers/{id}/certificates/` (NN-34, #102). PDF only;
 * shown "as provided", never "verified". Not the prototype `Certificate` in
 * `profile-growth.ts`, which has sample titles and issuers. */
export type PortfolioCertificate = {
  id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string | null;
};

/** The backend's limits, mirrored so the form catches mistakes first. The backend stays the authority. */
export const CERTIFICATE_LIMITS = {
  maxFiles: 10,
  maxBytes: 10 * 1024 * 1024,
  accept: ".pdf,application/pdf",
} as const;
