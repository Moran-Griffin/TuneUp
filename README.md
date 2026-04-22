# TuneUp

An iOS app for tracking vehicle maintenance history. TuneUp detects when you're at an auto shop, reminds you when service is due, and keeps a full log of your vehicle's maintenance history.

## Features

- **Auto-detection** — background geofencing detects when you've been at an auto shop for ~5 minutes and prompts you to log the visit
- **Maintenance reminders** — daily notifications when an oil change or inspection is due, until work is logged or an appointment is scheduled
- **Appointment scheduling** — links to shop websites; on return asks if you scheduled and saves it automatically
- **Service history** — full log of oil changes, inspections, emissions checks, and other services
- **Shop finder** — finds nearby auto shops using Google Places
- **Monthly mileage prompt** — reminds you to update your mileage on the 1st of each month
- **Offline support** — failed log entries are queued and synced automatically on next launch

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo Managed Workflow + React Native |
| Language | TypeScript |
| Navigation | Expo Router v3 |
| Styling | NativeWind v4 + Tailwind CSS v3 |
| Backend | Supabase (Auth + Postgres) |
| Notifications | Local (on-device scheduling via expo-notifications) |
| Location | expo-location background tasks |
| Place search | Google Places API |

## Getting Started

### Prerequisites

- Node.js 18+
- Xcode (for iOS builds)
- A [Supabase](https://supabase.com) project
- A Google Places API key

### Installation

```bash
git clone https://github.com/Moran-Griffin/TuneUp.git
cd TuneUp
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_key
```

### Database Setup

Run the migration in your Supabase SQL editor:

```bash
supabase/migrations/20260329000001_initial.sql
supabase/migrations/20260403000001_oil_interval_months.sql
```

### Running the App

```bash
# iOS simulator
npx expo run:ios

# Physical device (connected via USB)
npx expo run:ios --device

# Run tests
npm test
```

> Background location and notifications do not work in Expo Go. Use `npx expo run:ios` for full functionality.

## Project Structure

```
app/
  _layout.tsx          # Root layout — auth guard, notification tap routing
  (auth)/              # Welcome and vehicle setup screens
  (tabs)/              # Home, Log, Schedule, Profile tabs
  log/                 # Add and edit log entry screens
  schedule/            # Shop detail screen
components/            # Reusable UI components
hooks/                 # useAuth, useVehicle, useMaintenanceLogs, useAppointments, useShopSearch
lib/                   # supabase.ts, serviceStatus.ts, notifications.ts, locationTask.ts, offlineQueue.ts
types/index.ts         # Shared TypeScript interfaces
constants/             # Maintenance thresholds and service type labels
supabase/
  migrations/          # Database schema
  functions/           # Edge Functions (daily notification cron)
__tests__/             # Unit tests
```

## Notes

- iOS only — Android is not supported
- Requires "Always On" location permission for auto-detection to work
- Free Apple Developer account supported (7-day code signing via AltStore)
