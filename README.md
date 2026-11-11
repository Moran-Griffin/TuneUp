# TuneUp

An iOS app for tracking vehicle maintenance history. TuneUp detects when you're at an auto shop, reminds you when service is due, and keeps a full log of your vehicle's maintenance history.

## Features

- **Auto-detection** — background geofencing detects when you've been at an auto shop for ~5 minutes and prompts you to log the visit
- **Multiple vehicles** — add as many cars as you like; switch between them from the Home title, or pick **All vehicles** for an at-a-glance status overview
- **Maintenance reminders** — daily notifications (named for the car, e.g. "Oil Change Due: 2015 Honda Civic") when an oil change, inspection, or emissions test is due, until work is logged or an appointment is scheduled
- **Appointment scheduling** — links to shop websites; on return asks if you scheduled and saves it automatically
- **Service history** — full log of oil changes, inspections, emissions checks, and other services ("Other" entries can have a custom name)
- **Shop finder** — finds nearby auto shops using Google Places, sorted by distance (miles), with a search bar and quick service chips; tapping a shop opens its website
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
supabase/migrations/20260401000001_fixes.sql
supabase/migrations/20260403000001_oil_interval_months.sql
supabase/migrations/20260616000001_service_due_overrides.sql
supabase/migrations/20261109000001_multi_vehicle.sql
```

Run them in order, pasting each into the SQL editor. Don't use `supabase db push`:
the project's remote migration history is empty, so it would try to re-run the
initial migration.

### Running the App

```bash
# iOS simulator
npx expo run:ios

# Physical device (connected via USB)
npx expo run:ios --device

# Run tests
npm test
```

### Building an .ipa (sideload via SideStore)

Builds an unsigned Release `.ipa` and writes it to the project root as `TuneUp.ipa`.
SideStore re-signs it with your Apple ID at install time, so no distribution
certificate is needed.

```bash
./scripts/build-ipa.sh
```

This runs an unsigned device build and packages the result:

If you changed native config (`app.json`, plugins, native deps) since the last
build, run `npx expo prebuild -p ios` first to regenerate `ios/`.

If `pod install` crashes with `Unicode Normalization not appropriate for ASCII-8BIT`,
your shell isn't using UTF-8. Run `export LANG=en_US.UTF-8` and try again. The
`plugins/withPodDeploymentTarget.js` config plugin raises every pod to iOS 15.1,
which newer Xcode versions require.

### Installing on your iPhone with SideStore

SideStore installs the `.ipa` on your phone and signs it with your free Apple
Account. Free signatures expire after **7 days**. SideStore can renew them on
the phone itself, so after the one-time setup below you won't need your Mac.

Official docs: <https://docs.sidestore.io>

#### 1. Install SideStore (one-time, needs the Mac)

1. **On the iPhone:** install **LocalDevVPN** from the
   [App Store](https://apps.apple.com/app/localdevvpn/id6755608044). Open it
   and tap **Connect**. When asked to "Allow VPN Configurations", tap **Allow**
   and enter your passcode. This VPN only connects to the phone itself. It
   doesn't send your traffic anywhere else.
2. **On the Mac:** download and open **iloader**
   ([iloader-darwin-universal.dmg](https://github.com/nab138/iloader/releases/latest/download/iloader-darwin-universal.dmg)).
3. Plug the iPhone into the Mac. If the phone asks whether to trust the
   computer, tap **Trust** and enter your passcode.
4. In iloader, sign in with your Apple Account, select your iPhone, and click
   **Install SideStore (Stable)**. iloader also installs the pairing file that
   SideStore needs to sign apps without a computer.
5. **On the iPhone:** go to **Settings → General → VPN & Device Management**.
   Under **Developer App**, tap your Apple Account, then tap
   **Trust "<your Apple Account>"** and **Trust** again. Some iOS versions say
   **Allow & Restart** instead.
6. If the option is there, go to **Settings → Privacy & Security** and turn on
   **Developer Mode** at the bottom. The phone restarts.
7. Make sure LocalDevVPN is connected. Open **SideStore**, go to
   **Settings**, and sign in with the **same** Apple Account you used in
   iloader.
8. Go to **My Apps** and tap the **7 DAYS** button next to SideStore to
   refresh it once. If SideStore asks to revoke or create a signing
   certificate, tap **Yes** / **Refresh Now**. The phone returns to the Home
   Screen and SideStore reopens a few seconds later. That means setup worked.

You can unplug the phone now.

#### 2. Install TuneUp

1. On the Mac, run `./scripts/build-ipa.sh`. See
   [Building an .ipa](#building-an-ipa-sideload-via-sidestore) above.
2. Copy `TuneUp.ipa` to the iPhone. Either AirDrop it and choose
   **Save to Files**, or put it in iCloud Drive.
3. With LocalDevVPN connected, open **SideStore → My Apps**, tap **+** in the
   top-left corner, and pick `TuneUp.ipa` in the Files picker.
4. Wait for TuneUp to show up under **My Apps** with its own **7 DAYS**
   counter. Open it and allow notifications and **Always** location access.

> **Coming from AltStore?** SideStore signs apps differently, so delete the old
> AltStore-installed TuneUp first. Your maintenance data is stored in Supabase,
> so signing back in restores everything.

#### 3. Set up automatic refresh (so TuneUp never expires)

SideStore adds a **Refresh All Apps** action to the Shortcuts app. Running it
every day on a schedule renews the 7-day signature long before it runs out.

**Create the shortcut**

1. Open **Shortcuts → Shortcuts** tab and tap **+**. Name it **Refresh Apps**.
2. Add the **Set VPN** action. Set it to **Connect** and choose
   **LocalDevVPN**. Refresh fails if the VPN isn't connected.
3. Add a **Wait** action and set it to **3 seconds**. **Set VPN** finishes as
   soon as iOS *starts* connecting, not when the tunnel is up. Without this
   wait, Refresh sometimes runs before the VPN is ready, so it works only
   about half the time.
4. Add a second **Set VPN → Connect → LocalDevVPN** followed by another
   **Wait 3 seconds**. If the first connect didn't take, this one retries it.
   If the VPN is already connected, it does nothing.
5. Add SideStore's **Refresh All Apps** action. It has to be the **last**
   action, because nothing after it reliably runs.
6. Tap the action's chevron and turn **Show When Run** **off**.
7. Tap **Done**, then tap the shortcut once to run it by hand. Allow any
   permission prompts. If you skip this, the automation can't run unattended.

The finished shortcut is: Set VPN (Connect) → Wait 3s → Set VPN (Connect) →
Wait 3s → Refresh All Apps.

**Schedule it**

1. Open **Shortcuts → Automation** tab, tap **+**, and choose **Time of Day**.
2. Pick a time when the phone is usually on Wi-Fi and charging, such as
   **3:00 AM**. Set **Repeat** to **Daily**.
3. Choose **Run Immediately** instead of "Run After Confirmation", and leave
   **Notify When Run** off.
4. Tap **Next**, choose the **Refresh Apps** shortcut, and tap **Done**.

**Phone settings that keep it working**

- **Settings → General → Background App Refresh**: turn it on, both globally
  and for SideStore.
- **Low Power Mode** can stop the automation, so try not to have it on at the
  scheduled time.
- You can leave LocalDevVPN connected all the time if you like. It only routes
  traffic to the phone itself. If it gets in the way of another VPN you use,
  create a second Time of Day automation a few minutes later that runs
  **Set VPN → Disconnect → LocalDevVPN**.

To check that it's working, open **SideStore → My Apps** the next day. The
TuneUp and SideStore counters should be back at **7 DAYS**.

#### Updating TuneUp

Rebuild with `./scripts/build-ipa.sh`, copy the new `TuneUp.ipa` to the phone,
and install it with **My Apps → +** again. It replaces the existing app and
keeps its data.

#### Troubleshooting

- **"The operation took too long" when the shortcut runs:** this is a known
  quirk, and the refresh usually succeeded anyway. Check the counters in
  **My Apps**.
- **The shortcut only connects LocalDevVPN some of the time:** check that the
  shortcut has the **Wait** steps above. Also check **Settings → VPN** for
  any other VPN profile set to connect on demand (WireGuard, a work VPN, an
  old StosVPN). iOS runs only one VPN at a time, so an on-demand profile can
  take over. Turn its on-demand setting off or delete it. If it still fails,
  just leave LocalDevVPN connected all the time. It only routes traffic to
  the phone itself, so the shortcut's connect step has nothing left to do.
- **Refresh or install fails right away:** LocalDevVPN probably isn't
  connected, or the phone is on mobile data. Connect the VPN, switch to Wi-Fi,
  and tap the **7 DAYS** counter to refresh by hand.
- **Errors mentioning the pairing file or "invalid pairing":** the pairing file
  can stop working after an iOS update or at random. Plug into the Mac, open
  iloader, and reinstall the pairing file. Then refresh in SideStore. See
  [Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file).
- **The app won't open / "no longer available":** the signature expired. Open
  SideStore with the VPN on and tap the counter. If SideStore itself has
  expired, plug into the Mac and repeat step 1 with iloader.
- **Signing into SideStore fails with "This action cannot be completed at this
  time" (error -80046 or -80045):** since 2026-10-22, Apple has rejected
  sign-ins that use SideStore's old anisette servers. (Anisette is the
  device-identity data SideStore uses to sign in.) This fix worked on
  2026-11-09. Do the steps in this order:
  1. **SideStore → Settings → User Customizations**: turn **On-Device
     Anisette** off and restart SideStore when it asks.
  2. **Anisette Servers**: choose **SideStore (New)**
     (`new.ani.sidestore.io`). Then scroll to the bottom and turn **Enable
     Auto Rotation** off.
  3. **User Customizations → Anisette Client Configuration → Remote Server
     Sync**: tap **Fetch**, then **Save as Overrides**. Also tap the page's
     **Save Overrides** button.
  4. Back in **User Customizations**, tap **Reset adi.pb**.
  5. With LocalDevVPN connected, sign in **once** and wait. Don't tap again
     while it's working.

  If you get "HTTP 404" instead, set LocalDevVPN's **Tunnel IP** to
  `10.7.0.0/32` and its **Device IP** to `10.7.0.1/32`, then do the steps
  again. Apple may change this again; if it stops working, check
  [SideStore #1693](https://github.com/SideStore/SideStore/issues/1693) for
  newer fixes.
- **Free account limits:** SideStore can install at most **3 apps at once**,
  SideStore included, and **10 different App IDs per week**. Reinstalling
  TuneUp doesn't use up new App IDs.

> Background location and notifications do not work in Expo Go. Use `npx expo run:ios` for full functionality.

## Project Structure

```
app/
  _layout.tsx          # Root layout — auth guard, notification tap routing
  (auth)/              # Welcome and vehicle setup screens
  (tabs)/              # Home, Log, Schedule, Profile tabs
  log/                 # Add and edit log entry screens
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
- Free Apple Developer account supported: SideStore re-signs on-device every 7 days (set up its daily "Refresh apps" Shortcut automation so the app never expires)
