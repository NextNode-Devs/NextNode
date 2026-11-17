/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #102). Only prototype screens may import
 * this; never a Phase 1 screen.
 *
 * `sampleProfileGrowth(accountId)` gives any REAL developer (for example a
 * card from the live directory) stable sample values for the planned fields,
 * so prototype filters and badges have something to work with. The same id
 * always gives the same values, so server and browser renders match.
 */
import { TIME_ZONE_OPTIONS, type ProfileGrowth } from "./profile-growth";

export function sampleProfileGrowth(accountId: number): ProfileGrowth {
  const zones = TIME_ZONE_OPTIONS;
  return {
    account_id: accountId,
    // Every 7th developer has not set a time zone yet, so filters show the "Not set" case.
    time_zone: accountId % 7 === 0 ? null : zones[accountId % zones.length].value,
    is_new_talent: accountId % 3 === 0,
    certificates:
      accountId % 2 === 0
        ? [
            {
              id: accountId * 10 + 1,
              title: "AWS Certified Cloud Practitioner",
              issuer: "Amazon Web Services",
              issued_on: "2026-06-14",
              file_name: "aws-cloud-practitioner.pdf",
            },
          ]
        : [],
  };
}
