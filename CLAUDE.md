# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TuneUp** — an iOS-only mobile app for tracking vehicle maintenance history. Key features:
- Location-based detection: notifies user when they've been at an auto shop for ~5 minutes
- Maintenance reminder engine: calculates upcoming oil change / inspection due dates, sends persistent daily notifications until work is logged or appointment is scheduled
- Appointment scheduling: links out to shop websites via the user's default browser; on foreground resume asks "did you schedule?" and saves the appointment if yes
- Monthly mileage prompt on the 1st of each month

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo Managed Workflow + React Native |
| Language | TypeScript |
| Navigation | Expo Router v3 (file-based, `index.ts` → `import 'expo-router/entry'`) |
| Styling | NativeWind v4 + Tailwind CSS v3 (NOT v4 — NativeWind v4 requires Tailwind v3) |
| Backend | Supabase (Auth + Postgres + Edge Functions) |
| Push notifications | Expo Push Service → APNs |
| Location / geofencing | `expo-location` background tasks |
| Maps / place search | Google Places API (nearby search) |
| External browser | `Linking.openURL` (user's default browser) |

## Commands

```bash
npm test                    # run Jest tests
npx jest __tests__/foo.ts   # run a single test file
npx expo run:ios            # build and run on iOS simulator (requires Xcode)
```

> Background location tasks and push notifications do not work in Expo Go. Use `npx expo run:ios` or EAS Build for full testing.

## Architecture

### File Structure
```
app/
  _layout.tsx          # root layout — auth guard, AppState listener, notification tap routing
  (auth)/              # unauthenticated screens: welcome.tsx, vehicle-setup.tsx
  (tabs)/              # bottom tab bar: index.tsx (Home), log.tsx, schedule.tsx, profile.tsx
  log/                 # new.tsx (add entry), [id].tsx (edit entry)
  schedule/            # shop-detail.tsx
components/            # ServiceDueCard, LogEntryItem, AppointmentItem, ShopListItem, ScheduledAppointmentModal
hooks/                 # useAuth, useVehicle, useMaintenanceLogs, useAppointments, useShopSearch
lib/                   # supabase.ts, serviceStatus.ts, notifications.ts, locationTask.ts
types/index.ts         # all shared TypeScript interfaces (Vehicle, MaintenanceLog, Appointment, ServiceStatus, Shop)
constants/maintenance.ts  # SERVICE_TYPE_LABELS, OIL_CHANGE_WARNING_MILES, etc.
supabase/
  migrations/          # 20260329000001_initial.sql — full schema
  functions/daily-notifications/  # Edge Function cron (daily reminders + monthly mileage prompt)
__tests__/             # serviceStatus.test.ts (pure function tests, no RN deps)
```

### Key Architectural Decisions
- **Path alias `@/`** maps to project root (configured in tsconfig.json). Jest needs `moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" }` in jest.config.js.
- **Service due logic** lives in `lib/serviceStatus.ts` as pure functions — no React, no Supabase. Fully unit-testable.
- **Data model is multi-vehicle-ready** (`vehicles` table has `user_id` FK) but the UI ships single-vehicle.
- **Appointment booking**: `Linking.openURL` opens default browser → user returns manually → `AppState` foreground event triggers "did you schedule?" modal in root layout.
- **Daily cron** (Supabase Edge Function) handles all maintenance reminder push notifications and the monthly mileage prompt. No always-on background process needed.
- **Background geofence** uses `expo-location` + `expo-task-manager`. Requires "Always" location permission. Dwell time tracked via `AsyncStorage`. Fires local notification after 5 minutes at an auto shop.

### Data Model (Supabase)
- `user_profiles` — push token storage, auto-created on signup via trigger
- `vehicles` — one per user (UI), multi-vehicle-ready (schema)
- `maintenance_logs` — full service history; DB trigger auto-updates `vehicles` when oil_change or inspection is logged
- `appointments` — scheduled future work; status: scheduled | completed | cancelled

### Notification Types
- `location_prompt` → taps open `/log/new`
- `maintenance_reminder` → taps open `/(tabs)/schedule`
- `mileage_update` → taps open `/(tabs)/profile`

## Implementation Status

See `docs/superpowers/plans/2026-03-29-tuneup.md` for the full task-by-task implementation plan.
See `docs/superpowers/specs/2026-03-29-tuneup-design.md` for the design spec.

Tasks completed so far:
- Task 1: Project Scaffold (Expo init, deps, NativeWind config, folder structure)
- Task 2+: In progress via subagent-driven development
