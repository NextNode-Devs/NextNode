---
name: ui-ux
description: The UI/UX standard for all frontend work in this repo. Read BEFORE designing or building any screen, component, form, table, dialog or navigation, and again before calling a UI feature finished. Covers shadcn/ui as the primary system, visual hierarchy, feedback for every interaction, mobile-first layout, the full set of states (loading, empty, error, success, disabled, permission-denied), accessibility, and verifying the rendered UI rather than the source. Triggers on: "build a screen", "add a form", "the UI", "make it look", "responsive", "mobile", "dialog", "table", "empty state", "loading state", and on any change a developer, team lead or client will see.
---

# UI/UX standard — follow this for all frontend work

Treat yourself as a senior product designer **and** a senior frontend engineer.

The UI must feel like a polished production SaaS product, not an AI-generated
prototype.

Use **shadcn/ui as the primary UI system**. Prefer existing shadcn components
and compose them rather than creating custom UI from scratch. **Check the
existing project components before creating new ones.**

---

## 1. Clean, modern, professional

- Favor clean SaaS aesthetics.
- Strong visual hierarchy.
- Generous but intentional spacing.
- Avoid clutter.
- Avoid excessive borders, shadows, gradients and decorative elements.
- Every element should have a clear purpose.
- Do not make the interface visually busy just to make it look impressive.

## 2. Use shadcn/ui properly

Prefer: Button · Card · Badge · Alert · Dialog · Sheet · Drawer · Tabs ·
Select · Combobox · Table / Data Table · Form / Field · Empty · Skeleton ·
Tooltip · Popover · Separator · Dropdown Menu · Toggle Group · Breadcrumb ·
Sidebar.

Use existing variants before inventing custom styles.

**Do not recreate shadcn components with arbitrary divs and Tailwind classes
when an existing component already solves the problem.**

Use semantic design tokens rather than arbitrary colors.

## 3. Design for real users

Before implementing a screen, determine:

- Who is using it?
- What are they trying to accomplish?
- What information do they need?
- What is the primary action?
- What could confuse them?
- What happens after they click something?

Do not design around what is easiest to code. Design around the user's task.

## 4. Every interaction needs feedback

**Never create an action that appears to do nothing.**

Every meaningful action needs the appropriate: loading state · disabled state ·
success state · error state · empty state · confirmation where appropriate.

If an action changes something, the user should immediately understand that it
worked. **Do not rely on tiny timestamp changes or subtle visual differences as
the only feedback.**

## 5. Mobile first

Assume many users are on a phone. Every screen must work at mobile widths.
Check: buttons aren't cramped · tables don't destroy the layout · forms are
easy to complete · navigation works · dialogs and sheets fit the screen ·
important information isn't hidden · touch targets are comfortable.

Use Drawer on mobile where appropriate, Sheet/Dialog on larger screens.

## 6. Information hierarchy

Don't present every piece of information with equal visual weight. Use headings
for hierarchy, descriptions for context, Cards for grouped information, Badges
for status, Tables for structured datasets, Empty states when there is nothing
to show, Alerts for important information, and progressive disclosure when
there is too much.

A user should understand the page within a few seconds.

## 7. Forms

Forms should feel simple and intentional. Group related fields. Don't dump
fifteen inputs on the screen without structure.

Use field labels, descriptions where needed, validation messages, sensible
defaults, Select/Combobox where appropriate, and clear required/optional
indicators.

If a form is long, use progressive steps or logical sections rather than one
enormous form.

## 8. States

Design every feature for: initial · loading · populated · empty · error ·
success · disabled/read-only · permission denied.

**Don't implement only the happy path.**

## 9. Accessibility

Use semantic HTML and shadcn's accessibility patterns. Maintain keyboard
navigation, visible focus, aria labels where needed, `aria-current` /
`aria-selected` where appropriate, proper dialog titles, correct form
associations, and disabled states that actually prevent interaction.

**Never make something look disabled while leaving it interactive.**

## 10. Don't overdesign

Avoid unnecessary animations, giant hero sections inside application screens,
excessive rounded cards, excessive gradients, random icons, decorative text,
unnecessary modals, complicated navigation, and custom components where shadcn
already provides the pattern.

The goal is polished, not flashy.

## 11. Consistency

Before creating UI, inspect existing screens and components. Reuse spacing,
typography, button styles, card structure, navigation patterns, status badges,
form patterns and responsive behaviour.

A new screen should look like it belongs to the same application.

## 12. Think like a product designer

**If a requested implementation would create confusing UX, say so before coding
it.** Do not blindly implement a bad interaction because it was described that
way. Recommend a better interaction while keeping the underlying product
requirement intact.

## 13. Verify the UI

After implementing a feature: run the application, inspect the actual rendered
UI, test desktop and mobile, test the primary workflow, test loading/error/empty
states, check for console errors, check that buttons actually perform their
advertised actions, check that links actually navigate, and check that visual
states match actual application state.

**Do not report a UI as complete based only on the source code.**

---

## Functional correctness is not enough

A feature is complete only when:

1. It works.
2. It is understandable.
3. It gives the user appropriate feedback.
4. It works on mobile.
5. It is accessible.
6. It visually fits the existing product.
7. Its states are properly handled.

---


# In NextNode, specifically

The rules above are the standard. These bindings make them concrete here.

## Where the components are

- `frontend/src/shared/ui/shadcn/`: vendored primitives, added with the shadcn
  CLI only when a screen needs one. Record local edits in its `README.md`.
- `frontend/src/shared/ui/atoms/`, `molecules/`, `organisms/`: the project's
  wrappers, carrying the props this product speaks in (`label`, `hint`,
  `error`, `required`) and the accessibility wiring that is easy to forget.

Prefer a wrapper; import a raw primitive only where no wrapper exists yet, and
create the wrapper on its second use.

## Tokens: provisional, neutral, centralised

The brand theme is **not approved yet**. Until it is:

- Base palette is black, white and neutral grays. At most one or two restrained
  accent colours, marked provisional.
- All colours are CSS variables in `frontend/src/app/_styles/globals.css`
  (shadcn `radix-nova` preset, `neutral` base), exposed through shadcn's
  semantic names (`background`, `foreground`, `card`, `muted`,
  `muted-foreground`, `primary`, `secondary`, `accent`, `destructive`,
  `border`, `input`, `ring`) plus the project's provisional additions:
  `highlight` / `highlight-foreground` (the one accent), `success`, `warning`.
  Light and `.dark` values are both defined; there is no theme toggle yet.
- shadcn's `accent` is a neutral hover surface, not a brand colour. Use
  `highlight` for the accent.
- Components use token classes only (`bg-background`, `text-muted-foreground`,
  `border-border`). No hex, `rgb()` or raw palette classes (`bg-zinc-900`)
  in components, so the approved theme is a one-file change.
- Before using a colour class, check the token exists. Tailwind emits nothing
  for an undefined token and no build step complains; the element just renders
  colourless.
- Do not invent a logo, brand name treatment or marketing identity.

Use `ui-ux-pro-max` for palette, typography and layout reasoning, and
`design-system` for token structure, but keep its output inside the constraints
above.

## Roles shape screens

Three audiences, each with a primary task:

| Role | Primary task on most screens |
| --- | --- |
| Developer | Find a project, apply, show their portfolio, work in the team workspace |
| Team Lead | Fill the roster, move the project forward, keep the client updated |
| Client | Post a brief, pick a Team Lead, pay, review and approve |

A role that cannot act on something sees why ("Applications close when the
roster is locked"), not a disabled button with no explanation. A permission
failure renders a permission-denied state, not a blank page or a raw 403.

## Rules carried over from real use

Each of these was reported as a bug on a sibling project before it became a
rule.

- **Never render a control that does not work.** If a feature is not built, say
  so in words rather than shipping a control that does nothing.
- **A successful write changes something visible.** `router.refresh()` alone is
  not feedback; show the new state or a confirmation naming what changed.
- **Payments show the confirmed state, not the hoped-for one.** After Stripe
  Checkout returns, show "Confirming payment…" until the backend reports the
  webhook-confirmed status; never show "Paid" from the redirect alone.
- **Errors belong on the field**, and keep a banner too, because the field may
  be off screen. Show the API's own sentence; only decide where it goes. Clear a
  field's error as the person edits it.
- **Client validation mirrors the API's limits** (length, range, file type,
  file size). It exists for speed, never for authority.
- **Mark required fields honestly.** `required` renders the asterisk and sets
  the native attribute.
- **No `toLocaleString`/`toLocaleDateString` in rendered components.** It causes
  hydration mismatches. Use `shared/lib/format-date.ts`.
- **Constrain choices that must match later.** Tech stack and skill tags come
  from a fixed list or combobox, not free text, so search and matching work.
- **A label must not claim more than it knows.** "Verified" only on a GitHub
  link the backend actually verified.
- **Check the rendered box, not the markup.** Controls stay inside their
  container at every width.
- **Long lists need a way in.** Project search has filters and a query, kept in
  the URL so a filtered view is shareable.
- **One `h1` per screen**, naming what the screen is for.
- **Navigation says where you are**: `aria-current="page"` and a visible style
  together.
- **Motion is short and optional.** Respect `prefers-reduced-motion`.

## Verifying

Drive the real app with Playwright as each affected role (developer, team lead,
client): sign in, click through, submit, leave and come back. Assert on visible
text, `aria-invalid`, `aria-current`, bounding boxes at mobile (375px), tablet
(768px) and desktop (1280px), and zero console errors or hydration warnings.
Match text case-insensitively, and prove the session took before walking
routes, or every page redirects to sign-in and the check reports nothing.
