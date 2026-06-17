# Editable Service Due Targets — Design Spec

**Date:** 2026-06-16
**Status:** Approved (pending spec review)

## Problem

The three service status cards on the Home screen (Oil Change, Safety Inspection,
Emissions Test) compute their "due at" date/mileage from underlying vehicle fields
(last-service date/mileage + interval, compared against current mileage). This
computation is sometimes wrong from the user's perspective — most commonly because
the stored `current_mileage` has drifted higher than reality, so an oil change that
is genuinely *not* due shows as "overdue by N miles."

Example: last oil change at 36,449 mi, 5,000 mi interval → due at 41,449 mi (correct).
User is really at 40,500 mi, but `current_mileage` is stored as ~42,848, so the card
shows "1,399 miles overdue" (wrong).

The user wants a manual escape hatch: long-press a service card to directly set its
due target (and fix the drifting current mileage) rather than depending on the
computation always being right.

## Goals

- Long-press any of the three service cards to open a per-service edit modal.
- Directly override a service's due target; blank fields fall back to the existing
  computed value.
- Fix the shared `current_mileage` from the Oil Change editor, since that is the real
  driver of the "overdue by N miles" bug.
- Keep the daily push-notification cron consistent with what the screen shows.
- Overrides are an escape hatch, not permanent — logging the real service clears them.

## Non-Goals

- No pencil/edit icon affordance. Long-press only (single user, discoverability not a concern).
- No multi-vehicle handling beyond what already exists.
- No change to the appointment-scheduling or location-detection flows.

## Interaction

Long-pressing a `ServiceDueCard` opens a bottom-sheet modal styled like the existing
"Log Oil Change Date" modals on the Home screen. Each modal is scoped to one service.
Regular tap behavior on the cards is unchanged.

### Modal contents

- **Oil Change**
  - Current mileage — editable; writes the shared `vehicles.current_mileage`.
  - Due at mileage — optional override.
  - Due date — optional override.
- **Safety Inspection**
  - Due date — optional override.
- **Emissions Test**
  - Due date — optional override.

"Optional override" semantics:
- Blank → the app computes the value normally (today's behavior).
- Filled → that exact value is shown and used; the computed value is ignored for that track.
- Clearing a previously-filled field reverts to auto (sets the column back to `NULL`).

Date fields use the existing `DateTimePicker` pattern. Mileage uses a numeric `TextInput`.
Saving writes via the existing `useVehicle.updateVehicle`, then refetches so the card
re-renders. Validation: mileage values must be non-negative integers when present;
blank is allowed and means "clear override."

## Data Model

New migration adds four nullable columns to `vehicles`:

- `oil_due_mileage_override` integer null
- `oil_due_date_override` date null
- `inspection_due_date_override` date null
- `emissions_due_date_override` date null

Current mileage reuses the existing `current_mileage` column — no new field.

These columns are added to the `Vehicle` TypeScript interface in `types/index.ts` and
to the `Vehicle` interface inside the Edge Function.

## Status Logic (`lib/serviceStatus.ts`)

Each `get*Status` function is updated so that when an override is present it replaces
the computed `dueMileage` / `dueDate`, and `isOverdue` / `isDue` are recomputed from
the override:

- **Oil** — the two tracks stay independent:
  - If `oil_due_mileage_override` is set: `dueMileage = override`,
    `milesUntilDue = override - current_mileage`, `mileageOverdue = milesUntilDue < 0`,
    `mileageDueSoon = milesUntilDue <= OIL_CHANGE_WARNING_MILES`. Otherwise compute as today.
  - If `oil_due_date_override` is set: `dueDate = override`, `dateOverdue = now > override`.
    Otherwise compute as today.
  - `isOverdue = mileageOverdue || dateOverdue`, `isDue = mileageDueSoon || mileageOverdue || dateOverdue`.
- **Inspection / Emissions** — if the date override is set: `dueDate = override`,
  `daysUntilDue = floor((override - now) / day)`, thresholds applied as today.
- **No-record handling:** if any override for that service is set, the card is no longer
  treated as `noRecord`, even when the corresponding last-service field is null.

`ServiceDueCard` renders entirely from the returned `ServiceStatus`, so no display logic
changes there — only a new `onLongPress` prop wired to open the modal.

## Notifications Consistency (`supabase/functions/daily-notifications/index.ts`)

The cron recomputes due-status server-side, so it must honor the same overrides;
otherwise the screen could read "fine" while a push still says "overdue."

- `getOilDue` and `getInspectionDue` updated to apply overrides exactly as the client does.
- **Emissions added to push:** a new `getEmissionsDue` plus a reminder block mirroring
  inspection (respects `emissions_due_date_override`, skips if a scheduled emissions
  appointment exists, uses `emissions_interval_months`). This closes the existing gap
  where emissions only appears in-app and never sends a push.
- The pre-existing hardcoded `OIL_CHANGE_INTERVAL_MONTHS = 6` in the function is left
  as-is (out of scope); only override handling and emissions are added.

## Overrides Expire on Real Service

The existing `sync_vehicle_on_log` trigger (updates `last_*` fields when a maintenance
log is inserted) is extended in the new migration to also `NULL` out the matching
override columns:

- `oil_change` log → clears `oil_due_mileage_override`, `oil_due_date_override`.
- `inspection` log → clears `inspection_due_date_override`.
- `emissions_inspection` log → clears `emissions_due_date_override`.

This ensures a freshly logged service recomputes cleanly instead of being stuck on a
stale manual value. The delete-sync trigger is unchanged (deleting a log does not
restore an override).

## Testing

- Extend `__tests__/serviceStatus.test.ts` (pure functions, no RN deps):
  - Oil: mileage override only, date override only, both, neither (regression of current behavior).
  - Override that makes a previously-overdue service read as up-to-date, and vice versa.
  - Override present with null last-service field → not `noRecord`.
  - Inspection and Emissions date overrides → correct `daysUntilDue` / overdue.
- Manual verification on the iOS simulator: long-press each card, set/clear overrides,
  fix current mileage, confirm card updates and persists across refocus.

## Files Touched

- `supabase/migrations/20260616000001_service_due_overrides.sql` (new) — columns + trigger update.
- `types/index.ts` — add override fields to `Vehicle`.
- `lib/serviceStatus.ts` — override-aware status computation.
- `components/ServiceDueCard.tsx` — `onLongPress` prop.
- `app/(tabs)/index.tsx` — three edit modals + long-press wiring + save handlers.
- `supabase/functions/daily-notifications/index.ts` — override handling + emissions push.
- `__tests__/serviceStatus.test.ts` — new cases.
