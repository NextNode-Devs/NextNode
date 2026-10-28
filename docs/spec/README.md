# Source documents

The product is specified by these documents. They are the source of truth
after the approved decisions in `../decisions/phase-1-product-decisions.md`.

| Document | Expected file | Status |
| --- | --- | --- |
| CPAN314 Project Proposal — Group 1 | `CPAN314 Project Proposal - Group 1.pdf` | **Missing — please add** |
| Use Case Diagram + workflow description | `NextNode Use Case Diagram.pdf` | **Missing — please add** |
| Class Diagram + description | `NextNode Class Diagram.pdf` | **Missing — please add** |
| Activity Diagrams (main, Hire Team Lead, Hire Devs) | `NextNode Activity Diagram.pdf` | **Missing — please add** |
| Phase 1: Initial Prototype Development brief | `Phase_1.pdf` | **Missing — please add** |
| Editable diagram sources (draw.io / Figma) | — | Not provided |

The documents were reviewed from copies shared with the team lead; none are in
the repository yet.

## Correction needed: swapped activity-diagram titles

In `NextNode Activity Diagram.pdf`:

| Page | Title shown | What it actually depicts | Correct title |
| --- | --- | --- | --- |
| 3 | "Activity Diagram - Hire Devs" | Client posts a brief, opens the Team Lead spot, developers apply / client invites, chat, client accepts one, Team Lead role filled, other inboxes closed | **Hire Lead** (Hire Team Lead) |
| 4 | "Activity Diagram - Hire Lead" | Team Lead sets dev spots, invites / developers apply, chat, accept, roster grows until full, inboxes closed | **Hire Devs** |

The main diagram's references ("See 'Hire Team Lead' Activity Diagram" in the
Client lane, "See 'Hire Devs' Activity Diagram" in the Team Lead lane) are
correct. Only the two sub-diagram titles are swapped.

The PDF is not an editable source, so the titles have not been changed. Whoever
owns the diagram source should swap the two titles; no other part of either
diagram needs to change. Until then, the workflow definitions in
`../decisions/phase-1-product-decisions.md` define the meaning.
