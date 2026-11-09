# Multi-Vehicle, Keyboard Fix, Custom "Other" Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user register and switch between multiple vehicles (Home Overview/Detail, Profile add/edit, per-car notifications), stop the keyboard from covering inputs, and allow custom names for "Other" services.

**Architecture:** A single `VehicleProvider` React context (mounted in the root layout) owns the vehicle list, the persisted selected-vehicle id, the Home view mode, and centralized notification rescheduling; `useVehicle()` becomes a thin wrapper so existing screens keep compiling. All decision logic (display names, selection fallback, notification plan, service labels) lives in pure `lib/` modules with node Jest tests. UI uses a native iOS menu for switching and keyboard-controller for inputs.

**Tech Stack:** Expo SDK 54, RN 0.81.5, Expo Router 6, NativeWind v4 / Tailwind v3, Reanimated 4, Supabase, expo-notifications, `react-native-keyboard-controller`, `@react-native-menu/menu`.

**Spec:** `docs/superpowers/specs/2026-11-09-multi-vehicle-design.md`

## Global Constraints

- Work on branch `feat/multi-vehicle`; never commit to `master` directly.
- Before **every** `git commit`, invoke the `security-review` skill (user's global rule).
- Install native deps only with `npx expo install <pkg>` (SDK-54-pinned versions).
- Tailwind stays v3 (NativeWind v4 requirement). Reuse existing dark-mode color tokens from `components/ServiceDueCard.tsx` / `app/(tabs)/profile.tsx`.
- Status palette (verbatim from ServiceDueCard): overdue `bg-red-50 dark:bg-[#2c1516]` / `#ef4444`; due or scheduled `bg-yellow-50 dark:bg-[#2a2310]` / `#f59e0b`; ok `bg-green-50 dark:bg-[#0d2418]` / `#22c55e`.
- AsyncStorage key for selection: `@tuneup/selected_vehicle_id`.
- Notification identifiers: `"<vehicleId>:oil_change_reminder"`, `"<vehicleId>:inspection_reminder"`, `"<vehicleId>:emissions_reminder"`; legacy ids `oil_change_reminder`, `inspection_reminder`, `emissions_reminder` must be cancelled; mileage prompt id `mileage_update` unchanged.
- Notification titles: `Oil Change Due: <name>`, `Inspection Due: <name>`, `Emissions Test Due: <name>`.
- Supabase migrations are applied by hand in the Supabase SQL editor (remote migration history is empty; `supabase db push` would re-run the initial migration). Do not run `db push`.
- `lib/` pure modules must not import `react-native` or `expo-*` (they run in the node Jest project). Trigger types are the string literals `'date'` and `'calendar'` (values of `SchedulableTriggerInputTypes`).
- Unit tests: `npx jest --selectProjects logic`.

## Review Focus

1. **Single-vehicle user sees no change** — no dropdown chevron, no Overview, no vehicle rows in Add Entry/Log/Schedule. Pinned by `canSwitchVehicles` tests (Task 2).
2. **Selected vehicle deleted (or stored id stale after reinstall)** — selection falls back to the oldest remaining vehicle; zero vehicles → `null`, not a crash. Pinned by `resolveSelectedVehicleId` tests (Task 2).
3. **Upgrading from the single-vehicle build** — the old fixed-id reminders must be cancelled so the user doesn't get both "Oil Change Due" and "Oil Change Due: 2015 Civic". Pinned by `isMaintenanceNotificationId` tests (Task 3).
4. **Two identical cars without nicknames** (e.g. two 2015 Honda Civics) — names must stay distinguishable. Pinned by duplicate-name tests (Task 2).
5. **Whitespace-only custom label / switching type away from Other** — list shows "Other", saved label is `null`. Pinned by `logTypeLabel` / `normalizeCustomLabel` tests (Task 2).

---

### Task 1: Database migration + types

**Files:**
- Create: `supabase/migrations/20261109000001_multi_vehicle.sql`
- Modify: `types/index.ts` (Vehicle, MaintenanceLog, Appointment)

**Interfaces:**
- Produces: `Vehicle.nickname: string | null`, `MaintenanceLog.custom_label: string | null`, `Appointment.custom_label: string | null`.

- [ ] **Step 1: Write the migration**
  - `alter table public.vehicles add column if not exists nickname text;`
  - `alter table public.maintenance_logs add column if not exists custom_label text;`
  - `alter table public.appointments add column if not exists custom_label text;`
  - Replace policies `"Users manage own logs"` and `"Users manage own appointments"` (drop + create) with `for all using (auth.uid() = user_id) with check (auth.uid() = user_id and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))`.
  - `create or replace function public.complete_appointment(p_appointment_id uuid, p_mileage integer default null)`: select with `where id = p_appointment_id and user_id = auth.uid()`; insert includes `custom_label` from the appointment. Keep `security definer` and add `set search_path = public`.
- [ ] **Step 2: Update `types/index.ts`** with the three fields above.
- [ ] **Step 3: Type-check** — Run: `npx tsc --noEmit`. Expected: no new errors.
- [ ] **Step 4: Hand off to user to apply** — The user pastes the migration into Supabase Dashboard → SQL Editor and runs it. Verify with: `select column_name, table_name from information_schema.columns where column_name in ('nickname','custom_label');` Expected: 3 rows.
- [ ] **Step 5: Commit** (security-review first) — `feat(db): add nickname, custom_label; harden log/appointment RLS`

---

### Task 2: Pure helpers — names, selection, labels

**Files:**
- Create: `lib/vehicleDisplay.ts`, `lib/vehicleSelection.ts`, `lib/serviceLabel.ts`
- Test: `__tests__/vehicleDisplay.test.ts`, `__tests__/vehicleSelection.test.ts`, `__tests__/serviceLabel.test.ts`

**Interfaces:**
- Produces:
  - `vehicleDisplayName(v: Vehicle, all?: Vehicle[]): string`
  - `sortVehicles(vs: Vehicle[]): Vehicle[]` — `created_at` ascending, stable
  - `resolveSelectedVehicleId(vs: Vehicle[], storedId: string | null): string | null`
  - `canSwitchVehicles(vs: Vehicle[]): boolean` — `vs.length >= 2`
  - `logTypeLabel(entry: { type: ServiceType; custom_label?: string | null }): string`
  - `normalizeCustomLabel(type: ServiceType, label: string | null | undefined): string | null`
  - `recentCustomLabels(logs: Pick<MaintenanceLog,'type'|'custom_label'|'date'>[], limit = 5): string[]`

- [ ] **Step 1: Write failing tests** (use a `makeVehicle(overrides)` factory in each test file)

```ts
expect(vehicleDisplayName(makeVehicle({ year: '2015', make: 'Honda', model: 'Civic' }))).toBe('2015 Honda Civic');
expect(vehicleDisplayName(makeVehicle({ nickname: "Dad's truck", year: '2019' }))).toBe("Dad's truck (2019)");
expect(vehicleDisplayName(makeVehicle({ nickname: '   ', year: '2015', make: 'Honda', model: 'Civic' }))).toBe('2015 Honda Civic');
// duplicates: a (created 2026-01-01), b (created 2026-02-01), both 2015 Honda Civic
expect(vehicleDisplayName(a, [b, a])).toBe('2015 Honda Civic');
expect(vehicleDisplayName(b, [b, a])).toBe('2015 Honda Civic #2');

expect(resolveSelectedVehicleId([b, a], b.id)).toBe(b.id);
expect(resolveSelectedVehicleId([b, a], 'deleted-id')).toBe(a.id); // oldest
expect(resolveSelectedVehicleId([b, a], null)).toBe(a.id);
expect(resolveSelectedVehicleId([], 'x')).toBeNull();
expect(canSwitchVehicles([a])).toBe(false);
expect(canSwitchVehicles([a, b])).toBe(true);

expect(logTypeLabel({ type: 'other', custom_label: 'Wiper blades' })).toBe('Wiper blades');
expect(logTypeLabel({ type: 'other', custom_label: '  ' })).toBe('Other');
expect(logTypeLabel({ type: 'other', custom_label: null })).toBe('Other');
expect(logTypeLabel({ type: 'oil_change', custom_label: 'ignored' })).toBe('Oil Change');
expect(normalizeCustomLabel('other', '  Wipers ')).toBe('Wipers');
expect(normalizeCustomLabel('other', ' ')).toBeNull();
expect(normalizeCustomLabel('battery', 'Wipers')).toBeNull();
// recent: dates 2026-03-01 'Wipers', 2026-05-01 'wipers', 2026-04-01 'Cabin filter', plus an oil_change with label
expect(recentCustomLabels(logs)).toEqual(['wipers', 'Cabin filter']);
```

- [ ] **Step 2: Run** `npx jest --selectProjects logic __tests__/vehicleDisplay.test.ts __tests__/vehicleSelection.test.ts __tests__/serviceLabel.test.ts` — Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the three modules. `logTypeLabel` uses `SERVICE_TYPE_LABELS` from `@/constants/maintenance`. Duplicate suffix numbering is by position among same-base-name vehicles in `sortVehicles(all)`.
- [ ] **Step 4: Run** same command — Expected: PASS.
- [ ] **Step 5: Commit** (security-review first) — `feat: vehicle naming, selection and service label helpers`

---

### Task 3: Notification plan + centralized scheduler

**Files:**
- Create: `lib/notificationPlan.ts`
- Modify: `lib/notifications.ts` (replace `scheduleMaintenanceNotifications`, `cancelNotificationForServiceType`)
- Test: `__tests__/notificationPlan.test.ts`

**Interfaces:**
- Consumes: `vehicleDisplayName`, `sortVehicles` (Task 2); `getOilChangeStatus`, `getInspectionStatus`, `getEmissionsStatus` (existing `lib/serviceStatus.ts`).
- Produces:
  - `type PlannedNotification = { identifier: string; content: { title: string; body: string; data: Record<string, unknown> }; trigger: { type: 'date'; date: Date } | { type: 'calendar'; hour: number; minute: number; day?: number; repeats: true } }`
  - `buildNotificationPlan(vehicles: Vehicle[], now: Date): PlannedNotification[]`
  - `maintenanceNotificationId(vehicleId: string, service: 'oil_change' | 'inspection' | 'emissions_inspection'): string`
  - `isMaintenanceNotificationId(id: string): boolean` — true for legacy ids and any `"<uuid>:<x>_reminder"`
  - In `lib/notifications.ts`: `scheduleAllNotifications(vehicles: Vehicle[]): Promise<void>` and `cancelVehicleServiceNotification(vehicleId: string, service: ServiceType): Promise<void>`

- [ ] **Step 1: Write failing tests**
  - Two vehicles (one overdue oil, one with inspection due in future, emissions disabled) → plan contains `"<id1>:oil_change_reminder"` with calendar trigger `{hour: 9, minute: 0, repeats: true}` and title `Oil Change Due: 2015 Honda Civic`; `"<id2>:inspection_reminder"` with `date` trigger equal to the status due date; no emissions entry for the disabled vehicle; exactly one `mileage_update` (calendar `day: 1, hour: 9, minute: 0`).
  - Each maintenance entry's `content.data` equals `{ type: 'maintenance_reminder', vehicleId }`.
  - `buildNotificationPlan([], now)` → `[]` (no mileage prompt without vehicles).
  - `isMaintenanceNotificationId('oil_change_reminder')` true; `('abc:inspection_reminder')` true; `('mileage_update')` false; `('random')` false.
  - Oil fire-date fallback preserved: vehicle with no `dueDate` and `oil_change_interval_months = 4` → date trigger = `now` + 4 months (same rule as current `lib/notifications.ts:44-47`).
- [ ] **Step 2: Run** `npx jest --selectProjects logic __tests__/notificationPlan.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `buildNotificationPlan`** porting the trigger rules from `lib/notifications.ts:31-111`, bodies verbatim, per vehicle in `sortVehicles` order, using `vehicleDisplayName(v, vehicles)`.
- [ ] **Step 4: Rewrite `lib/notifications.ts`**: keep `setNotificationHandler` and `requestPermissions`; `scheduleAllNotifications` = request permission → `getAllScheduledNotificationsAsync()` → cancel those whose identifier `isMaintenanceNotificationId` or equals `mileage_update` → schedule every plan entry. Serialize calls (a module-level promise chain) so overlapping reschedules can't interleave. Delete `scheduleMaintenanceNotifications` and `cancelNotificationForServiceType`.
- [ ] **Step 5: Run** `npx jest --selectProjects logic` — Expected: PASS (all logic tests).
- [ ] **Step 6: Commit** (security-review first) — `feat: per-vehicle notification plan and centralized scheduler`

---

### Task 4: VehicleProvider + rewiring hooks and root layout

**Files:**
- Create: `hooks/VehicleContext.tsx`
- Modify: `hooks/useVehicle.ts`, `hooks/useMaintenanceLogs.ts`, `hooks/useAppointments.ts`, `app/_layout.tsx`, `app/(auth)/vehicle-setup.tsx`, `lib/offlineQueue.ts`

**Interfaces:**
- Consumes: Task 2 helpers; `scheduleAllNotifications`, `cancelVehicleServiceNotification` (Task 3).
- Produces:
  - `<VehicleProvider userId={string | undefined}>`
  - `useVehicles(): { vehicles: Vehicle[] /* sorted */; selectedVehicle: Vehicle | null; selectedId: string | null; selectVehicle(id: string): void; homeView: 'detail' | 'overview'; setHomeView(v: 'detail' | 'overview'): void; loading: boolean; refetch(): Promise<void>; createVehicle(data: VehicleInput): Promise<Vehicle>; updateVehicle(id: string, data: VehicleInput): Promise<Vehicle>; deleteVehicle(id: string): Promise<void> }` where `type VehicleInput = Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at'>>`
  - `useVehicle(): { vehicle: Vehicle | null; loading: boolean; refetch(); createVehicle(data); updateVehicle(data); deleteVehicle() }` — same shape as today but **no `userId` argument**, bound to the selected vehicle.
  - `useMaintenanceLogs(vehicleId)` and `useAppointments(vehicleId)` lose their `vehicle` parameter; after any mutation they call `refetch()` from `useVehicles()` instead of scheduling notifications.

- [ ] **Step 1: Implement `VehicleProvider`**: fetch `vehicles` with `.select('*').eq('user_id', userId)` (no `.single()`); load stored id from AsyncStorage; `selectedId = resolveSelectedVehicleId(vehicles, stored)`; persist on `selectVehicle`; `createVehicle` selects the new vehicle; `deleteVehicle` re-resolves selection. Effect: whenever `vehicles` changes (and `userId` set), call `scheduleAllNotifications(vehicles)`.
- [ ] **Step 2: Mount provider** in `app/_layout.tsx` around `<Stack>` and the modal (pass `session?.user.id`). Move the layout's body into a child component so it can call `useVehicles()`. Remove the layout's own `scheduleMaintenanceNotifications` call (keep `startLocationTracking`).
- [ ] **Step 3: Notification tap**: for `maintenance_reminder` with `data.vehicleId`, call `selectVehicle(vehicleId)` and `setHomeView('detail')` before the existing `router.push`.
- [ ] **Step 4: Update hooks** — replace every `scheduleMaintenanceNotifications(...)` in `useMaintenanceLogs`, `useAppointments`, `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx` with `refetch()` from `useVehicles()`; replace `cancelNotificationForServiceType(type)` with `cancelVehicleServiceNotification(vehicleId, type)`; update every `useVehicle(session?.user.id)` call site to `useVehicle()`. `addLog`/`updateLog` and `addAppointment` accept optional `custom_label?: string | null`; `QueuedLog` gets `custom_label?: string | null` and `replayQueue` passes it through.
- [ ] **Step 5: `vehicle-setup.tsx`** creates via `createVehicle` from `useVehicles()` (so it becomes selected and notifications schedule).
- [ ] **Step 6: Verify** — `npx tsc --noEmit` (no errors) and `npx jest --selectProjects logic` (PASS). Grep: `grep -rn "scheduleMaintenanceNotifications\|cancelNotificationForServiceType\|useVehicle(session" app hooks lib components` → no matches.
- [ ] **Step 7: Commit** (security-review first) — `refactor: shared VehicleProvider with persisted selection`

---

### Task 5: Native deps + keyboard fix

**Files:**
- Modify: `package.json` (via expo install), `app/_layout.tsx`, `app/(tabs)/profile.tsx`, `app/log/new.tsx`, `app/log/[id].tsx`, `app/(auth)/welcome.tsx`, `app/(auth)/vehicle-setup.tsx`, `app/(tabs)/index.tsx` (modals only)

**Interfaces:**
- Produces: `KeyboardProvider` mounted at root; installed `@react-native-menu/menu` for Tasks 6–8.

- [ ] **Step 1: Install** — `npx expo install react-native-keyboard-controller @react-native-menu/menu`.
- [ ] **Step 2: Wrap root** `app/_layout.tsx` content in `<KeyboardProvider>` (outermost, outside `VehicleProvider` is fine).
- [ ] **Step 3: Replace** `ScrollView` with `KeyboardAwareScrollView` (`bottomOffset={80}`, keep existing className/contentContainerClassName) in the six form screens listed. On Home, wrap each text-input modal's card in keyboard-controller `KeyboardAvoidingView` `behavior="padding"`. If `welcome.tsx` uses RN `KeyboardAvoidingView`, replace it rather than nest.
- [ ] **Step 4: Rebuild native** — `npx expo prebuild -p ios` then `./scripts/build-ipa.sh`. Expected: `==> Done: .../TuneUp.ipa`.
- [ ] **Step 5: Device check** (user installs via SideStore → My Apps → +): on Profile, unlock and tap "Safety Inspection Interval (months)"; on Add Entry, tap Notes; on Home oil edit modal, tap Due mileage. Expected: each field stays visible above the keyboard while typing.
- [ ] **Step 6: Commit** (security-review first) — `fix: keep focused inputs above the keyboard`

---

### Task 6: Home — vehicle switcher + Overview

**Files:**
- Create: `components/VehicleSwitcher.tsx`, `components/VehicleOverview.tsx`
- Modify: `app/(tabs)/index.tsx` (header at line ~321; early returns)

**Interfaces:**
- Consumes: `useVehicles()` (Task 4); `vehicleDisplayName`, `canSwitchVehicles` (Task 2); status functions in `lib/serviceStatus.ts`.
- Produces:
  - `VehicleSwitcher({ title: string; subtitle?: string })` — renders title (text-2xl bold) + subtitle; when `canSwitchVehicles`, wraps the title in `MenuView` with actions `[{ id: 'all', title: 'All vehicles', state: homeView==='overview' ? 'on' : 'off' }, ...vehicles.map(v => ({ id: v.id, title: vehicleDisplayName(v, vehicles), state: homeView==='detail' && v.id===selectedId ? 'on' : 'off' }))]` and shows a `ChevronDown` (lucide, size 20). `onPressAction`: `'all'` → `setHomeView('overview')`; else `selectVehicle(id)` + `setHomeView('detail')`.
  - `VehicleOverview()` — ScrollView of cards per spec §Home — Overview; chip helper `statusTone(status: ServiceStatus, scheduled: boolean): 'red' | 'yellow' | 'green'` reusing ServiceDueCard rules (scheduled ignored in Overview → pass `false`). Emissions disabled → gray chip "Off".

- [ ] **Step 1: Implement `VehicleSwitcher`** and replace the Home header `<Text>` pair (`{vehicle.year} {vehicle.make} {vehicle.model}` / mileage) with `<VehicleSwitcher title={vehicleDisplayName(vehicle, vehicles)} subtitle={`${mileage} miles`} />`.
- [ ] **Step 2: Implement `VehicleOverview`** with header `<VehicleSwitcher title="All vehicles" />`; card `onPress` → `selectVehicle(v.id)`, `setHomeView('detail')`.
- [ ] **Step 3: In `HomeScreen`**, when `homeView === 'overview' && canSwitchVehicles(vehicles)` return `<VehicleOverview />` before the Detail body. Reset the no-record prompt guard (`promptedServices`) when `selectedId` changes so each car gets its own one-time prompts.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; on device with 2 cars: dropdown lists All vehicles + both cars with checkmark; Overview shows both cards, correct colors, no "next due" text, no Recent Service; tapping a card opens its Detail. With 1 car: no chevron.
- [ ] **Step 5: Commit** (security-review first) — `feat(home): vehicle switcher and all-vehicles overview`

---

### Task 7: Profile — add, collapse, per-vehicle edit

**Files:**
- Create: `components/VehicleForm.tsx`, `app/vehicle/new.tsx`
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useVehicles()` (Task 4); `vehicleDisplayName`, `canSwitchVehicles` (Task 2).
- Produces: `VehicleForm({ vehicle: Vehicle | null; onSaved?(v: Vehicle): void; onDeleted?(): void; lockable?: boolean })` — the current Profile Vehicle fields (Make, Model, Year, Current Mileage, Oil interval miles, Oil interval months, Safety Inspection interval) plus **Nickname (optional)** as the first field, today's validation messages verbatim, lock/unlock behavior when `lockable`, Save → `updateVehicle(vehicle.id, …)` or `createVehicle(…)`, and a red **Delete This Vehicle** action (only when `vehicle` set) with an Alert listing that vehicle's name and "all of its service log entries and appointments".

- [ ] **Step 1: Extract `VehicleForm`** from `profile.tsx` lines 40-200 (state, effects, validation, save, delete); empty nickname saves `null`.
- [ ] **Step 2: Create `app/vehicle/new.tsx`**: header with Cancel + "Add Vehicle", `<VehicleForm vehicle={null} onSaved={() => router.back()} />` inside `KeyboardAwareScrollView`.
- [ ] **Step 3: Rebuild Profile layout** per spec §Profile (0 / 1 / ≥2 vehicles). Accordion: `Animated.View` from Reanimated with `layout={LinearTransition}`, expanded content `entering={FadeIn}` `exiting={FadeOut}`; header `Pressable` with `accessibilityState={{ expanded }}`; rows ordered selected first then `sortVehicles` order; only one row's form open at a time. Add button: full-width `bg-blue-600 rounded-xl py-3` "+ Add Vehicle" → `router.push('/vehicle/new')`. After returning from add, the accordion is collapsed.
- [ ] **Step 4: Emissions section** binds to `selectedVehicle` (toggle + interval save via `updateVehicle(selectedVehicle.id, …)`), title suffix ` — <name>` when ≥2 vehicles. Remove the bottom "Reset Vehicle Data" section.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; device: with 1 car Profile matches today plus Add button; add a 2nd car → section collapses, selected car listed first, Edit opens inline form, Save updates name in Home dropdown, Delete removes car and Home falls back to remaining car.
- [ ] **Step 6: Commit** (security-review first) — `feat(profile): add and edit multiple vehicles`

---

### Task 8: Log/Schedule follow selected car + custom "Other" name

**Files:**
- Modify: `app/(tabs)/log.tsx`, `app/(tabs)/schedule.tsx`, `app/log/new.tsx`, `app/log/[id].tsx`, `components/LogEntryItem.tsx`, `components/AppointmentItem.tsx`

**Interfaces:**
- Consumes: `useVehicles()` (Task 4); `logTypeLabel`, `normalizeCustomLabel`, `recentCustomLabels`, `vehicleDisplayName`, `canSwitchVehicles` (Task 2); `MenuView` (Task 5).

- [ ] **Step 1: Labels** — `LogEntryItem` and `AppointmentItem` render `logTypeLabel(entry)` instead of `SERVICE_TYPE_LABELS[...]`. `log.tsx` filter logic (line 27) stays `l.type === filter`.
- [ ] **Step 2: Headers** — Log and Schedule show `vehicleDisplayName(selectedVehicle, vehicles)` as a gray subtitle under the title when `canSwitchVehicles`.
- [ ] **Step 3: Add Entry vehicle row** — in `app/log/new.tsx`, local `vehicleId` state defaulting to `selectedId`; when `canSwitchVehicles`, a "Vehicle" row (bordered like the Date field) wrapped in `MenuView` listing all vehicles; `useMaintenanceLogs(vehicleId)` / `useAppointments(vehicleId)` use it; model-year minimum date uses the chosen vehicle.
- [ ] **Step 4: Custom name input** — in `new.tsx` and `[id].tsx`, when `type === 'other'` render "Custom name (optional)" `TextInput` (placeholder `e.g. Wiper blades`) directly under the Service Type picker, plus up to 5 suggestion chips from `recentCustomLabels(logs)` (tap fills the field; chip style = the Log filter chip style). Save passes `custom_label: normalizeCustomLabel(type, customLabel)` to `addLog` / `updateLog` / `addAppointment`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; `npx jest --selectProjects logic` PASS; device: log an Other entry named "Wiper blades" → list shows "Wiper blades"; "Other" filter chip shows it; edit it to Battery → shows "Battery"; with 2 cars, Add Entry vehicle row switches the target car and the entry appears only under that car's Log.
- [ ] **Step 6: Commit** (security-review first) — `feat: per-vehicle log/schedule and custom Other names`

---

### Task 9: Docs + final build

**Files:**
- Modify: `README.md` (Features list; note migration `20261109000001_multi_vehicle.sql` must be run in SQL editor), `CLAUDE.md` (remove "UI ships single-vehicle"; describe VehicleProvider, notification ids, new deps)

- [ ] **Step 1: Update docs** as listed.
- [ ] **Step 2: Full verification** — `npx tsc --noEmit` clean; `npm test` PASS; `npx expo prebuild -p ios && ./scripts/build-ipa.sh` succeeds.
- [ ] **Step 3: Device notification check** — with 2 cars, one overdue: open app, then in Settings → Notifications confirm only titled reminders arrive (`Oil Change Due: <name>`), no untitled legacy ones; tap one → Home Detail opens on that car.
- [ ] **Step 4: Commit** (security-review first) — `docs: multi-vehicle architecture and setup`
