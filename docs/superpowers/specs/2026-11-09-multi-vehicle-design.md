# Multi-Vehicle, Keyboard Fix, Custom "Other" Label — Design

**Date:** 2026-11-09
**Status:** Approved (decisions from session Q&A; research in `.operator.md` → Recon)

## Goals

1. A user can register multiple vehicles and switch between them.
2. Text inputs low on the screen are never hidden behind the keyboard.
3. "Other" service entries can carry a custom name.

## 1. Multi-vehicle

### Selection model
- One **selected vehicle** shared app-wide (Home detail, Log tab, Schedule tab, Profile emissions, Add Entry default). Persisted in AsyncStorage key `@tuneup/selected_vehicle_id`; on launch, if the stored id no longer exists, fall back to the oldest vehicle (`created_at` ascending).
- Home has a second mode, **Overview** ("All vehicles"). Home mode is not persisted; app launch opens Detail for the selected vehicle.
- With exactly one vehicle, Home shows no dropdown and no Overview (identical to today).

### Vehicle display name
- `nickname` (new optional column) set → `"<nickname> (<year>)"`; otherwise `"<year> <make> <model>"`.
- If two vehicles produce the same display name, the later-created one(s) get suffix `" #2"`, `" #3"`, ordered by `created_at`.
- Used in: Home dropdown, Overview cards, Profile vehicle list, Log/Schedule headers, Add Entry vehicle row, notification titles.

### Home — Detail (today's Home)
- Header vehicle name becomes a native iOS menu trigger (`@react-native-menu/menu`), shown with a chevron only when ≥2 vehicles. Menu items: **All vehicles**, then each vehicle (checkmark on the selected one, in `created_at` order).
- Everything else on the Detail view is unchanged.

### Home — Overview
- Header title "All vehicles" with the same menu.
- Scrollable list, one card per vehicle (`created_at` order): display name and year, current mileage, three status chips — Oil Change, Inspection, Emissions — colored with the existing ServiceDueCard palette (red overdue / yellow due or scheduled / green ok). Emissions chip shows gray "Off" when `emissions_enabled` is false. No "next due" text, no Recent Service section.
- Tapping a card selects that vehicle and switches to Detail.

### Profile
- **0 vehicles:** today's blank Vehicle form (creates the first vehicle).
- **1 vehicle:** today's Vehicle section (with lock), then a full-width **+ Add Vehicle** button, then Emissions Inspection.
- **≥2 vehicles:** the Vehicles section is a collapsed accordion. Collapsed header: selected vehicle's display name + chevron. Expanded: all vehicles, selected one first, each row = name + **Edit** button. Edit expands that vehicle's form inline below its row (same fields as today, plus Nickname, plus **Delete This Vehicle**). The full-width Add Vehicle button sits below this section.
- **Add Vehicle** opens `/vehicle/new` (same fields as the Profile form incl. Nickname); on save the new vehicle becomes selected and the user returns to Profile.
- Emissions Inspection section applies to the selected vehicle and its title names it: "Emissions Inspection — <display name>" (name suffix only when ≥2 vehicles).
- The bottom "Reset Vehicle Data" section is replaced by the per-vehicle Delete in the edit form (and on the 1-vehicle form). Deleting the selected vehicle selects the oldest remaining one.

### Log & Schedule tabs
- Both follow the selected vehicle and show its display name under the screen title when ≥2 vehicles.
- Add Entry (`/log/new`) shows a "Vehicle" row (native menu) defaulting to the selected vehicle; the entry/appointment is saved to the chosen vehicle. Row hidden when 1 vehicle.

### Notifications (local, `expo-notifications`)
- One notification per vehicle per service, title `"<Service> Due: <display name>"` (Oil Change / Inspection / Emissions Test), bodies unchanged, identifier `"<vehicleId>:<service>"`, data `{ type: 'maintenance_reminder', vehicleId }`. Trigger rules unchanged (date trigger when not overdue, daily 9:00 calendar trigger when overdue).
- Monthly mileage prompt: one notification for all vehicles, unchanged (identifier `mileage_update`).
- Rescheduling is centralized: whenever the vehicle list changes, cancel every TuneUp maintenance notification (new ids, and legacy ids `oil_change_reminder`, `inspection_reminder`, `emissions_reminder`) and schedule the full set. Deleted vehicles therefore lose their reminders.
- Tapping a maintenance reminder selects its `vehicleId` before navigating.
- Booking an appointment cancels only that vehicle's notification for that service.

### Data model (migration `20261109000001_multi_vehicle.sql`, applied manually in Supabase SQL editor)
- `vehicles.nickname text null`
- `maintenance_logs.custom_label text null`, `appointments.custom_label text null`
- `complete_appointment` copies `custom_label` into the log and only acts on appointments where `user_id = auth.uid()`.
- RLS hardening: logs/appointments insert/update require the `vehicle_id` to belong to `auth.uid()`.

## 2. Keyboard covering inputs
- Add `react-native-keyboard-controller` (`npx expo install`), `KeyboardProvider` at the root layout.
- Replace form `ScrollView`s with `KeyboardAwareScrollView` (`bottomOffset` 80) on: Profile, `/vehicle/new`, `/log/new`, `/log/[id]`, `(auth)/welcome`, `(auth)/vehicle-setup`. Text-input modals on Home use keyboard-controller's `KeyboardAvoidingView` (`behavior="padding"`).
- Requires one native rebuild (`npx expo prebuild -p ios` then `./scripts/build-ipa.sh`); shares that rebuild with `@react-native-menu/menu`.

## 3. Custom name for "Other"
- When type is Other on Add Entry / Edit Entry, show **Custom name (optional)** input with up to 5 tappable suggestions from the user's previous custom labels (most recent first, case-insensitive dedupe).
- Lists (Log tab, Home Recent Service, Schedule appointments) show the trimmed custom label in place of "Other"; blank/whitespace label shows "Other".
- Filtering is unchanged: the "Other" chip matches all `type = 'other'` entries regardless of label.
- Switching type away from Other saves `custom_label = null`.

## Out of scope
- Edge Function `daily-notifications` (dormant: no push tokens are ever registered).
- Archived/sold vehicles, photos, vehicle ordering, family sharing (recorded in Recon for later).
