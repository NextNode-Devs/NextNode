# NN-39 · Assistant Lead and inactivity on developer projects (#101)

Branch `feature/101-assistant-lead-inactivity`, from `develop`. Owner:
`jayparmarsectionA`. Cross-tester: `Hardik33`. Rules:
`docs/decisions/phase-2-product-decisions.md` (17 Nov and 21 Nov 2026).

NN-39 applies to **developer projects only** (ideas a developer created and
leads). Client projects have no Assistant Lead and are never checked.

## What it does

| Issue bullet | What was built |
| --- | --- |
| The Lead chooses an Assistant Lead | The Team Lead picks one member on the project page. Choosing again replaces them. Only the Lead can choose, and only one of the team's members. |
| The Assistant Lead's permissions shown on the roster | The roster labels them "Assistant Lead". The project page lists what they can and can't do. They can never remove the Lead, override the Lead or choose another Assistant Lead. Closing the project works today; the other permissions are labelled "Planned". |
| After 30 days of Lead inactivity: "Is this project still active?" | A daily job asks the members once the Team Lead hasn't written in the project's workspace chat for 30 days. The question appears on the project page for the Lead and members, live. |
| Hidden from the feed while waiting | `GET /api/projects/` leaves out any project with a pending question. |
| A confirming member can be elected Assistant Lead | The first member to answer "Yes, it's still active" becomes Assistant Lead if the team has none. The project returns to the feed. |
| No answer in 7 days: closed | The daily job sets the project to the new `Closed` status. It leaves the feed and is never asked again. |

Also in this branch (decided 21 Nov 2026): **the "New talent" tag** on a
developer card, and the "New talent only" filter, now mean **the account was
created in the past 15 days**. The API works it out from the account's creation
time; before this it was a sample value.

## How inactivity is measured

- **Activity** = a message from the Team Lead in the project's workspace chat.
  Messages from members don't count. Milestones will count once they exist.
- A developer project gets its workspace chat when it starts, so **only
  started projects are checked**. Until the Lead's first message, the clock
  starts when the chat opened.
- If the Lead writes again, or answers the question themselves, the question
  ends and the project stays open. After any answer, the 30 days start again.
- If the Lead or Assistant Lead closes the project while members are being
  asked, the question ends too.

## Running the daily check

```bash
cd backend
uv run python manage.py check_project_activity                  # once (schedule daily)
uv run python manage.py check_project_activity --every 3600     # keep running, hourly
uv run python manage.py check_project_activity --as-of 2026-12-25T09:00:00+00:00  # simulate a date
```

It prints which projects it asked, closed, or found the Lead active again on.
Running it more often than daily is safe: each step acts only once its
deadline has passed. Schedule it with cron, Windows Task Scheduler or the
`--every` worker. There is no scheduler in the stack yet.

## API

All need a signed-in, onboarded user. Changes reach the team live as
`team.updated` socket frames (`reason`: `assistant_lead`, `activity_check`,
`activity_confirmed`, `project_closed`), and the project page refreshes.

| Method and path | Who | Does |
| --- | --- | --- |
| `GET /api/projects/{id}/stewardship/` | Team Lead and members | Assistant Lead, their permissions, the Lead's last activity, when members would be asked, the current or last check, and the viewer's allowed actions |
| `PUT /api/projects/{id}/assistant-lead/` `{account_id}` | Team Lead | Choose or replace the Assistant Lead |
| `POST /api/projects/{id}/activity-check/confirm/` | Members (or the Lead) | Answer "still active" |
| `POST /api/projects/{id}/close/` | Team Lead or Assistant Lead | Close the developer project |

Others get 403. Client projects get 409 ("Client projects have no Assistant
Lead"). `GET /api/projects/{id}/team/` now shows `role: "assistant_lead"`, and
each `GET /api/developers/` card has `joined_at` and `is_new_talent`.

## Changes, by file

**Backend: domain**
- `domain/projects/project.py`: new `Closed` status; `Project.close()` (developer projects, from `Posted` or `InProgress`); `is_open`.
- `domain/projects/team.py`: `assistant_lead_account_id`; `with_assistant_lead` (Lead only, a member only), `elect_assistant_lead`, `is_assistant_lead`, `is_steward`.
- `domain/projects/activity_check.py` (new): `ActivityCheck` (pending → confirmed | lead_returned | closed), `LEAD_INACTIVE_DAYS = 30`, `ANSWER_DAYS = 7`, `inactive_since`.
- `domain/accounts/new_talent.py` (new): `NEW_TALENT_DAYS = 15`, `is_new_talent`.

**Backend: application**
- `application/stewardship/` (new): ports (`ActivityChecks`, `LeadActivity`), views, and the use cases `GetStewardship`, `ChooseAssistantLead`, `ConfirmProjectActive`, `CloseDeveloperProject` and `RunActivityChecks`.
- `application/accounts/directory.py`: cards carry `joined_at` and `is_new_talent`; `SearchDevelopers` takes the clock.
- `application/accounts/ports.py`: `DeveloperPortfolio.joined_at`.

**Backend: infrastructure and API**
- Migration `0009_stewardship`: the `project_activity_check` table (one pending check per project), the `assistant_lead` membership role (one per team), the `Closed` project status (developer projects only).
- `persistence/stewardship_models.py`, `persistence/stewardship.py` (new): the table and its adapters; Lead activity from workspace messages.
- `persistence/projects.py`: maps the Assistant Lead; saves the role; the feed excludes projects with a pending check.
- `persistence/portfolios.py`: passes the account's creation time.
- `access_rules.py`: `project_team` `read` (Lead and members) and `steward` (Lead or Assistant Lead) in the shared policy.
- `stewardship_wiring.py` (new) and `container.py`: wiring, kept outside `container.py` for its 500-line limit.
- `presentation/api/stewardship.py` (new) and `urls.py`: the four endpoints.
- `management/commands/check_project_activity.py` (new): the daily job.

**Frontend**
- `entities/team`: `Stewardship` types and API calls; `TeamMember.role` gains `assistant_lead`.
- `entities/project`: `Closed` status and label.
- `features/choose-assistant-lead`, `features/confirm-project-active`, `features/close-developer-project` (new).
- `widgets/project-stewardship` (new): the "Assistant Lead and activity" card and the question, on the project page for the Lead and members.
- `widgets/team-roster`: shows "Assistant Lead:" on the roster.
- `entities/developer`: `DeveloperCard.joined_at` and `is_new_talent`; the card's New talent badge uses it.
- `views/developer-directory`, `features/filter-developers`: the New talent filter uses the API's value; its explanation says "joined NextNode in the past 15 days".

**Docs**
- `docs/decisions/phase-2-product-decisions.md`: decisions of 21 Nov 2026.
- `.claude/skills/nextnode-spec/SKILL.md`: the rule book entries.
- `docs/backlog-phase-2.md`: NN-39 and NN-34 notes.
- `README.md`: "Built by NN-39".

## Tests

- Backend: `test_stewardship_domain.py`, `test_stewardship_use_cases.py` (fixed clock), `test_stewardship_api.py` (PostgreSQL, the command with `--as-of`, the feed), plus the new talent tests in `test_portfolio_domain.py` and `test_developer_directory.py`.
- Frontend: the stewardship card, choosing the Assistant Lead, the question, the roster, and the directory's New talent badge and filter.

## Testing it by hand

1. Sign up a Team Lead and four developers with Clerk test emails (`name+clerk_test@example.com`, code `424242`), each in their own browser profile.
2. As the Lead: create a developer project, set the team size to 5 and invite the four. Each accepts.
3. As the Lead: close the proposal and finalise the timeline. The project starts and its chat opens.
4. On the project page, choose an Assistant Lead. The roster shows them.
5. Run `check_project_activity --as-of <30 days after the start>`. Members see the question; the project leaves the feed.
6. As a member: answer "Yes". They become Assistant Lead if there was none.
7. Or run the command again 7 days later with nobody answering: the project is `Closed`.
8. In `/developers`, only accounts created in the past 15 days show "New talent".

## Known limits

- Only the workspace chat counts as activity, so projects that haven't started are never checked.
- There is no project suggestion pool yet; only the feed hides waiting projects.
- The Assistant Lead's other permissions (members, details, complete) are not enforced yet and are labelled "Planned".
- A closed project's chat stays open.
- The New talent filter still narrows one page at a time, until the API filters on it (#93).
