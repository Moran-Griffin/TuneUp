# TuneUp — Design Spec

## Context

Vehicle owners often have no structured way to track maintenance history beyond a notes app or glove box receipts. TuneUp solves this with a dedicated mobile app that logs service history, proactively reminds users when maintenance is due, and uses location detection to prompt logging when the user is at an auto shop. The app is designed for iOS-first personal/small-group use, with a JavaScript-familiar developer.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo Managed Workflow + React Native |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for React Native) |
| Backend | Supabase (Auth + Postgres + Edge Functions) |
| Push notifications | Expo Push Service → APNs |
| Location / geofencing | `expo-location` (background tasks) |
| Maps / place search | Apple MapKit |
| External browser | `Linking.openURL` (user's default browser) |

**Note:** Background tasks and push notifications require a dev build (via EAS Build or local Xcode). They do not work in Expo Go.

---

## Screens & Navigation

### Auth Flow (unauthenticated)
1. **Welcome** — sign in / sign up (email + password via Supabase Auth)
2. **Vehicle Setup** — onboarding form: make, model, year, current mileage, last oil change date + mileage, last inspection date, oil change interval (default 5,000 mi), inspection interval (default 12 months)

### Main App — Bottom Tab Bar

**Home**
- Cards showing next service due (oil change, inspection)
- Overdue alerts highlighted
- Recent maintenance activity feed
- Quick-add FAB to log new entry

**Log**
- Full service history list, filterable by type
- Add / edit entry form:
  - Required: type (oil_change | inspection | tire_rotation | brake_service | battery | other), date
  - Optional: mileage, shop name, cost, notes
- Entries are editable after creation

**Schedule**
- Upcoming appointments list (cancel / mark complete)
- Find a shop: nearby mechanics and dealerships via Apple Maps search
- Shop detail: name, address, phone, website
- "Book appointment" → opens shop website in the user's default browser via `Linking.openURL`
- On app foreground resume after browser open: modal "Did you schedule an appointment?" → Yes / No
  - Yes → prompt for service type, date, time → saves appointment → pauses reminders for that service type
  - No → dismiss → daily reminders continue

**Profile**
- Vehicle details (editable)
- Notification preferences
- Account settings / sign out

---

## Data Model (Supabase / Postgres)

```sql
-- Managed by Supabase Auth
users (id uuid PK, email, created_at)

-- Multi-vehicle-ready; UI exposes one vehicle per account for now
vehicles (
  id uuid PK,
  user_id uuid FK → users,
  make, model, year text,
  current_mileage int,
  last_oil_change_date date,
  last_oil_change_mileage int,
  oil_change_interval_miles int DEFAULT 5000,
  last_inspection_date date,
  inspection_interval_months int DEFAULT 12,
  created_at timestamptz
)

maintenance_logs (
  id uuid PK,
  vehicle_id uuid FK → vehicles,
  user_id uuid FK → users,
  type text NOT NULL,        -- required
  date date NOT NULL,        -- required
  mileage int,               -- optional
  shop_name text,            -- optional
  cost numeric,              -- optional
  notes text,                -- optional
  created_at timestamptz,
  updated_at timestamptz
)

appointments (
  id uuid PK,
  vehicle_id uuid FK → vehicles,
  user_id uuid FK → users,
  shop_name text,
  shop_url text,
  scheduled_date date,
  scheduled_time time,
  service_type text,
  status text DEFAULT 'scheduled', -- scheduled | completed | cancelled
  created_at timestamptz
)
```

**Key logic:** When a `maintenance_logs` entry of type `oil_change` or `inspection` is saved, the corresponding fields on `vehicles` are updated (resetting the reminder clock).

All tables use Supabase Row Level Security — users can only read/write their own rows.

---

## Notification Engine

### 1. Location-based detection
- `expo-location` background task monitors GPS
- On entering a geofence around an auto shop / dealership (Apple Maps POI category matching)
- If user remains in geofence for ≥5 minutes → local push notification: *"You've been at [place name] for a bit — getting work done?"*
- Tapping the notification opens the quick-add log entry screen
- If user leaves or ignores: timer resets, no repeat until next visit
- Requires user to grant "Always" location permission (explained during onboarding)

### 2. Maintenance reminders (persistent until resolved)

**Trigger conditions:**
- Oil change: mileage within 500 mi of interval, OR ≥6 months since last change
- Inspection: 30 days before anniversary of last inspection date

**Delivery:** Supabase Edge Function on a daily cron checks all vehicles and sends push notifications via Expo Push Service → APNs. No always-on background process required.

**Silenced by:**
- User logs the completed work → vehicle record updated → reminders stop
- User schedules an appointment → reminders suppressed until appointment date passes without a log entry (then resume)
- No other dismissal path (by design — the goal is accountability)

### 3. Monthly mileage update reminder
- On the 1st of each month, a push notification prompts: *"Time to update your mileage — keeping it current helps track when your next oil change is due."*
- Tapping opens the vehicle edit screen with the mileage field focused
- Delivered via the same Supabase daily cron (checks if today is the 1st)

---

## Appointment Booking Flow

1. User taps "Book appointment" on a shop
2. Shop website opens in the user's default browser app (`Linking.openURL` — respects whatever browser the user has set as default)
3. User books on shop's site, then manually returns to TuneUp
4. App detects foreground resume (`AppState` change) after a browser-open event
5. Modal: "Did you schedule an appointment?" → Yes / No
6. Yes: prompt service type, date, time → save appointment record → suppress reminder
7. No: dismiss → reminders continue as normal

---

## Constraints & Decisions

- **Single-vehicle UI, multi-vehicle data model:** The `vehicles` table supports multiple rows per user from day one. UI ships with single-vehicle flow; adding a vehicle picker later requires only UI changes.
- **No booking API integrations:** Too fragmented across shops. TuneUp links out to each shop's own site — works for any shop anywhere.
- **iOS only (for now):** Android support is not in scope but the React Native + Expo stack makes it straightforward to add later.
- **Dev build required for full feature testing:** Background location and push notifications require EAS Build or local Xcode build — cannot be tested in Expo Go.
- **Target audience:** Friends & family / small group. Supabase free tier is sufficient; no public App Store launch in initial scope.
