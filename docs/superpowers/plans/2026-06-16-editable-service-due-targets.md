# Editable Service Due Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user long-press any of the three Home-screen service status cards to manually override its due date/mileage (and fix current mileage from the Oil card), with overrides clearing automatically when the real service is logged.

**Architecture:** Add four nullable override columns to `vehicles`. Make the pure `serviceStatus.ts` functions prefer an override over the computed value. Wire long-press on `ServiceDueCard` to per-service bottom-sheet edit modals on the Home screen that save via `useVehicle.updateVehicle` and re-run `scheduleMaintenanceNotifications`. A DB trigger nulls the matching override when a real service log is inserted.

**Tech Stack:** Expo / React Native, TypeScript, NativeWind, Supabase Postgres (SQL migration + plpgsql trigger), Jest.

**Reference spec:** `docs/superpowers/specs/2026-06-16-editable-service-due-targets-design.md`

---

### Task 1: Database migration — override columns + override-clearing trigger

**Files:**
- Create: `supabase/migrations/20260616000001_service_due_overrides.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260616000001_service_due_overrides.sql`:

```sql
-- Manual due-target overrides for the Home-screen service status cards.
alter table vehicles
  add column if not exists oil_due_mileage_override integer,
  add column if not exists oil_due_date_override date,
  add column if not exists inspection_due_date_override date,
  add column if not exists emissions_due_date_override date;

-- When a real service is logged, clear the matching manual override so the
-- freshly logged service recomputes cleanly instead of staying pinned to a
-- stale manual value. (Redefines the latest sync_vehicle_on_log from the
-- initial migration, adding the override-clearing lines.)
create or replace function public.sync_vehicle_on_log()
returns trigger language plpgsql security definer as $$
begin
  if new.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = case when last_oil_change_date is null or new.date >= last_oil_change_date then new.date else last_oil_change_date end,
      last_oil_change_mileage = case when new.mileage is not null and (last_oil_change_date is null or new.date >= last_oil_change_date) then new.mileage else last_oil_change_mileage end,
      current_mileage = case when new.mileage is not null and new.mileage > current_mileage then new.mileage else current_mileage end,
      oil_due_mileage_override = null,
      oil_due_date_override = null
    where id = new.vehicle_id;
  elsif new.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = case when last_inspection_date is null or new.date >= last_inspection_date then new.date else last_inspection_date end,
      inspection_due_date_override = null
    where id = new.vehicle_id;
  elsif new.type = 'emissions_inspection' then
    update public.vehicles set
      last_emissions_date = case when last_emissions_date is null or new.date >= last_emissions_date then new.date else last_emissions_date end,
      emissions_due_date_override = null
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;
```

- [ ] **Step 2: Verify the SQL is self-consistent**

Confirm the `create or replace function` body matches the latest `sync_vehicle_on_log` definition in `supabase/migrations/20260329000001_initial.sql` (lines ~163-183) with only the three `*_override = null` additions. The trigger `sync_vehicle_after_log` already exists and points at this function — do NOT recreate the trigger.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260616000001_service_due_overrides.sql
git commit -m "feat: add service due override columns and clear-on-log trigger"
```

---

### Task 2: Add override fields to the `Vehicle` type

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add the four fields to the `Vehicle` interface**

In `types/index.ts`, inside `interface Vehicle`, add these lines immediately after `emissions_interval_months: number;`:

```typescript
  oil_due_mileage_override: number | null;
  oil_due_date_override: string | null;
  inspection_due_date_override: string | null;
  emissions_due_date_override: string | null;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors). Pre-existing errors unrelated to these fields, if any, can be ignored.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add due-override fields to Vehicle type"
```

---

### Task 3: Override-aware status logic (TDD)

**Files:**
- Modify: `lib/serviceStatus.ts`
- Test: `__tests__/serviceStatus.test.ts`

- [ ] **Step 1: Update `baseVehicle` and add failing override tests**

In `__tests__/serviceStatus.test.ts`, replace the `baseVehicle` definition (and the import line) so all `Vehicle` fields are present, then add the override test suites. Replace lines 1-17 with:

```typescript
import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';
import { Vehicle } from '@/types';

const baseVehicle: Vehicle = {
  id: '1',
  user_id: 'u1',
  make: 'Toyota',
  model: 'Camry',
  year: '2020',
  current_mileage: 50000,
  last_oil_change_date: null,
  last_oil_change_mileage: null,
  oil_change_interval_miles: 5000,
  oil_change_interval_months: 6,
  last_inspection_date: null,
  inspection_interval_months: 12,
  emissions_enabled: false,
  last_emissions_date: null,
  emissions_interval_months: 24,
  oil_due_mileage_override: null,
  oil_due_date_override: null,
  inspection_due_date_override: null,
  emissions_due_date_override: null,
  created_at: '2024-01-01T00:00:00Z',
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}
```

Then append these suites to the end of the file:

```typescript
describe('getOilChangeStatus overrides', () => {
  it('uses oil_due_mileage_override instead of the computed due mileage', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 40500,
      last_oil_change_mileage: 36449,
      last_oil_change_date: monthsAgo(1),
      oil_due_mileage_override: 50000,
    };
    const status = getOilChangeStatus(v);
    expect(status.dueMileage).toBe(50000);
    expect(status.milesUntilDue).toBe(9500);
    expect(status.isOverdue).toBe(false);
  });

  it('is overdue when current mileage is past the mileage override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 41000,
      last_oil_change_mileage: 36449,
      last_oil_change_date: monthsAgo(1),
      oil_due_mileage_override: 40000,
    };
    const status = getOilChangeStatus(v);
    expect(status.milesUntilDue).toBe(-1000);
    expect(status.isOverdue).toBe(true);
  });

  it('uses oil_due_date_override for the date track, ignoring a stale last-change date', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 46000,
      last_oil_change_mileage: 45000,
      last_oil_change_date: monthsAgo(8),
      oil_due_date_override: daysFromNow(60),
    };
    const status = getOilChangeStatus(v);
    expect(status.isOverdue).toBe(false);
  });

  it('is not treated as noRecord when only an override is set', () => {
    const v: Vehicle = { ...baseVehicle, oil_due_mileage_override: 60000 };
    const status = getOilChangeStatus(v);
    expect(status.noRecord).toBe(false);
    expect(status.dueMileage).toBe(60000);
  });
});

describe('getInspectionStatus override', () => {
  it('uses inspection_due_date_override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      last_inspection_date: null,
      inspection_due_date_override: daysFromNow(10),
    };
    const status = getInspectionStatus(v);
    expect(status.isOverdue).toBe(false);
    expect(status.isDue).toBe(true);
    expect(status.noRecord).toBe(false);
  });

  it('is overdue when the override date is in the past', () => {
    const v: Vehicle = { ...baseVehicle, inspection_due_date_override: daysFromNow(-5) };
    const status = getInspectionStatus(v);
    expect(status.isOverdue).toBe(true);
  });
});

describe('getEmissionsStatus override', () => {
  it('uses emissions_due_date_override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      last_emissions_date: null,
      emissions_due_date_override: daysFromNow(-3),
    };
    const status = getEmissionsStatus(v);
    expect(status.isOverdue).toBe(true);
    expect(status.noRecord).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/serviceStatus.test.ts`
Expected: FAIL — the new override assertions fail because `serviceStatus.ts` ignores the override fields (e.g. `dueMileage` is `41449`, not `50000`).

- [ ] **Step 3: Implement override-aware status logic**

Replace the entire contents of `lib/serviceStatus.ts` with:

```typescript
import { Vehicle, ServiceStatus } from '@/types';
import {
  OIL_CHANGE_WARNING_MILES,
  INSPECTION_WARNING_DAYS,
  EMISSIONS_WARNING_DAYS,
} from '@/constants/maintenance';

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getOilChangeStatus(vehicle: Vehicle): ServiceStatus {
  const hasOverride =
    vehicle.oil_due_mileage_override !== null || vehicle.oil_due_date_override !== null;

  if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage && !hasOverride) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let mileageOverdue = false;
  let mileageDueSoon = false;
  let milesUntilDue: number | null = null;
  let dueMileage: number | null = null;

  if (vehicle.oil_due_mileage_override !== null) {
    dueMileage = vehicle.oil_due_mileage_override;
  } else if (vehicle.last_oil_change_mileage !== null) {
    dueMileage = vehicle.last_oil_change_mileage + vehicle.oil_change_interval_miles;
  }
  if (dueMileage !== null) {
    milesUntilDue = dueMileage - vehicle.current_mileage;
    mileageOverdue = milesUntilDue < 0;
    mileageDueSoon = milesUntilDue <= OIL_CHANGE_WARNING_MILES;
  }

  let dateOverdue = false;
  let dueDate: Date | null = null;

  if (vehicle.oil_due_date_override !== null) {
    dueDate = parseDate(vehicle.oil_due_date_override);
    dateOverdue = now > dueDate;
  } else if (vehicle.last_oil_change_date) {
    dueDate = parseDate(vehicle.last_oil_change_date);
    dueDate.setMonth(dueDate.getMonth() + vehicle.oil_change_interval_months);
    dateOverdue = now > dueDate;
  }

  const isDue = mileageDueSoon || mileageOverdue || dateOverdue;
  const isOverdue = mileageOverdue || dateOverdue;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage, milesUntilDue, daysUntilDue: null };
}

export function getInspectionStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_inspection_date && !vehicle.inspection_due_date_override) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let dueDate: Date;
  if (vehicle.inspection_due_date_override) {
    dueDate = parseDate(vehicle.inspection_due_date_override);
  } else {
    dueDate = parseDate(vehicle.last_inspection_date!);
    dueDate.setMonth(dueDate.getMonth() + vehicle.inspection_interval_months);
  }

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= INSPECTION_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}

export function getEmissionsStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_emissions_date && !vehicle.emissions_due_date_override) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let dueDate: Date;
  if (vehicle.emissions_due_date_override) {
    dueDate = parseDate(vehicle.emissions_due_date_override);
  } else {
    dueDate = parseDate(vehicle.last_emissions_date!);
    dueDate.setMonth(dueDate.getMonth() + vehicle.emissions_interval_months);
  }

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= EMISSIONS_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}
```

- [ ] **Step 4: Run the full test file to verify it passes**

Run: `npx jest __tests__/serviceStatus.test.ts`
Expected: PASS — all suites, including the pre-existing oil/inspection tests and the new override tests.

- [ ] **Step 5: Commit**

```bash
git add lib/serviceStatus.ts __tests__/serviceStatus.test.ts
git commit -m "feat: make service status logic honor manual due overrides"
```

---

### Task 4: Add `onLongPress` to `ServiceDueCard`

**Files:**
- Modify: `components/ServiceDueCard.tsx`

- [ ] **Step 1: Add the prop and make the card long-pressable**

In `components/ServiceDueCard.tsx`:

Add `onLongPress?: () => void;` to the `Props` interface (after `scheduledDate?: string;`).

Add `onLongPress` to the destructured params:
```typescript
export function ServiceDueCard({ title, status, onSchedule, onNoRecord, noRecordLabel, isScheduled, scheduledDate, onLongPress }: Props) {
```

Change the outer container from `<View ...>` to a long-pressable wrapper. Replace the opening tag:
```typescript
    <View className={`${bgColor} ${borderColor} border rounded-2xl p-4 mb-3`}>
```
with:
```typescript
    <TouchableOpacity
      activeOpacity={onLongPress ? 0.7 : 1}
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`${bgColor} ${borderColor} border rounded-2xl p-4 mb-3`}
    >
```
and change the matching closing `</View>` (the last line of the returned JSX) to `</TouchableOpacity>`.

`TouchableOpacity` is already imported on line 1. The inner action buttons remain nested `TouchableOpacity`s and keep working; with no `onPress` on the wrapper, normal taps on empty card area do nothing.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add components/ServiceDueCard.tsx
git commit -m "feat: support long-press on ServiceDueCard"
```

---

### Task 5: Home-screen edit modals, long-press wiring, and save handlers

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Add imports and destructure `updateVehicle`**

In `app/(tabs)/index.tsx`, add this import near the other `@/lib` imports:
```typescript
import { scheduleMaintenanceNotifications } from '@/lib/notifications';
```

Change the `useVehicle` destructure (currently `const { vehicle, loading: vehicleLoading, refetch: refetchVehicle } = useVehicle(session?.user.id);`) to also pull `updateVehicle`:
```typescript
  const { vehicle, loading: vehicleLoading, refetch: refetchVehicle, updateVehicle } = useVehicle(session?.user.id);
```

- [ ] **Step 2: Add a date-string parse helper**

Below the existing `toDisplayDate` function, add:
```typescript
function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
```

- [ ] **Step 3: Add edit-modal state**

After the existing "Emissions modal" state block (the `savingEmissions` line), add:
```typescript
  // Oil edit (override) modal
  const [editOilVisible, setEditOilVisible] = useState(false);
  const [editOilCurrentMileage, setEditOilCurrentMileage] = useState('');
  const [editOilDueMileage, setEditOilDueMileage] = useState('');
  const [editOilDueDate, setEditOilDueDate] = useState<Date | null>(null);
  const [showEditOilDatePicker, setShowEditOilDatePicker] = useState(false);
  const [savingOilEdit, setSavingOilEdit] = useState(false);

  // Inspection edit (override) modal
  const [editInspectionVisible, setEditInspectionVisible] = useState(false);
  const [editInspectionDueDate, setEditInspectionDueDate] = useState<Date | null>(null);
  const [showEditInspectionDatePicker, setShowEditInspectionDatePicker] = useState(false);
  const [savingInspectionEdit, setSavingInspectionEdit] = useState(false);

  // Emissions edit (override) modal
  const [editEmissionsVisible, setEditEmissionsVisible] = useState(false);
  const [editEmissionsDueDate, setEditEmissionsDueDate] = useState<Date | null>(null);
  const [showEditEmissionsDatePicker, setShowEditEmissionsDatePicker] = useState(false);
  const [savingEmissionsEdit, setSavingEmissionsEdit] = useState(false);
```

- [ ] **Step 4: Add open + save handlers**

After the existing `handleSaveEmissionsDate` function, add:
```typescript
  function openOilEdit() {
    if (!vehicle) return;
    setEditOilCurrentMileage(String(vehicle.current_mileage));
    setEditOilDueMileage(vehicle.oil_due_mileage_override != null ? String(vehicle.oil_due_mileage_override) : '');
    setEditOilDueDate(vehicle.oil_due_date_override ? parseDateString(vehicle.oil_due_date_override) : null);
    setShowEditOilDatePicker(false);
    setEditOilVisible(true);
  }

  async function handleSaveOilEdit() {
    if (!vehicle) return;
    const cm = parseInt(editOilCurrentMileage, 10);
    if (editOilCurrentMileage.trim() === '' || isNaN(cm) || cm < 0) {
      Alert.alert('Validation', 'Current mileage must be a non-negative number.');
      return;
    }
    let dueMileageOverride: number | null = null;
    if (editOilDueMileage.trim() !== '') {
      const dm = parseInt(editOilDueMileage, 10);
      if (isNaN(dm) || dm < 0) {
        Alert.alert('Validation', 'Due mileage must be a non-negative number.');
        return;
      }
      dueMileageOverride = dm;
    }
    setSavingOilEdit(true);
    try {
      const updated = await updateVehicle({
        current_mileage: cm,
        oil_due_mileage_override: dueMileageOverride,
        oil_due_date_override: editOilDueDate ? toDateString(editOilDueDate) : null,
      });
      if (updated) scheduleMaintenanceNotifications(updated).catch(() => {});
      setEditOilVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingOilEdit(false);
    }
  }

  function openInspectionEdit() {
    if (!vehicle) return;
    setEditInspectionDueDate(vehicle.inspection_due_date_override ? parseDateString(vehicle.inspection_due_date_override) : null);
    setShowEditInspectionDatePicker(false);
    setEditInspectionVisible(true);
  }

  async function handleSaveInspectionEdit() {
    if (!vehicle) return;
    setSavingInspectionEdit(true);
    try {
      const updated = await updateVehicle({
        inspection_due_date_override: editInspectionDueDate ? toDateString(editInspectionDueDate) : null,
      });
      if (updated) scheduleMaintenanceNotifications(updated).catch(() => {});
      setEditInspectionVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingInspectionEdit(false);
    }
  }

  function openEmissionsEdit() {
    if (!vehicle) return;
    setEditEmissionsDueDate(vehicle.emissions_due_date_override ? parseDateString(vehicle.emissions_due_date_override) : null);
    setShowEditEmissionsDatePicker(false);
    setEditEmissionsVisible(true);
  }

  async function handleSaveEmissionsEdit() {
    if (!vehicle) return;
    setSavingEmissionsEdit(true);
    try {
      const updated = await updateVehicle({
        emissions_due_date_override: editEmissionsDueDate ? toDateString(editEmissionsDueDate) : null,
      });
      if (updated) scheduleMaintenanceNotifications(updated).catch(() => {});
      setEditEmissionsVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingEmissionsEdit(false);
    }
  }
```

- [ ] **Step 5: Wire long-press onto the three cards**

Add `onLongPress={openOilEdit}` to the Oil Change `<ServiceDueCard>`, `onLongPress={openInspectionEdit}` to the Safety Inspection `<ServiceDueCard>`, and `onLongPress={openEmissionsEdit}` to the Emissions Test `<ServiceDueCard>` (each added as a new prop alongside the existing `onSchedule` etc.).

- [ ] **Step 6: Add the three edit modals**

Immediately before the final closing `</>` of the returned JSX (after the existing "Emissions Modal" `</Modal>`), add:

```tsx
      {/* Edit Oil Due Modal */}
      <Modal visible={editOilVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Edit Oil Change</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">Leave a due field blank to use the automatic estimate.</Text>

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Current mileage</Text>
            <TextInput
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
              value={editOilCurrentMileage}
              onChangeText={setEditOilCurrentMileage}
              keyboardType="numeric"
            />

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Due at mileage (optional)</Text>
            <TextInput
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
              value={editOilDueMileage}
              onChangeText={setEditOilDueMileage}
              placeholder="Auto"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Due date (optional)</Text>
            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => {
                if (!editOilDueDate) setEditOilDueDate(new Date());
                setShowEditOilDatePicker(!showEditOilDatePicker);
              }}
            >
              <Text className="text-base text-gray-900 dark:text-white">{editOilDueDate ? toDisplayDate(editOilDueDate) : 'Auto — tap to set'}</Text>
            </TouchableOpacity>
            {editOilDueDate && (
              <TouchableOpacity className="mb-2" onPress={() => { setEditOilDueDate(null); setShowEditOilDatePicker(false); }}>
                <Text className="text-blue-600 dark:text-[#0a84ff] text-sm">Clear date override</Text>
              </TouchableOpacity>
            )}
            {showEditOilDatePicker && editOilDueDate && (
              <DateTimePicker
                value={editOilDueDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setEditOilDueDate(selected); }}
              />
            )}
            <View className="mb-4" />

            <TouchableOpacity className="bg-blue-600 rounded-xl py-4 items-center mb-3" onPress={handleSaveOilEdit} disabled={savingOilEdit}>
              <Text className="text-white font-semibold text-base">{savingOilEdit ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => setEditOilVisible(false)}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Inspection Due Modal */}
      <Modal visible={editInspectionVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Edit Safety Inspection</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">Leave blank to use the automatic estimate.</Text>

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Due date (optional)</Text>
            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => {
                if (!editInspectionDueDate) setEditInspectionDueDate(new Date());
                setShowEditInspectionDatePicker(!showEditInspectionDatePicker);
              }}
            >
              <Text className="text-base text-gray-900 dark:text-white">{editInspectionDueDate ? toDisplayDate(editInspectionDueDate) : 'Auto — tap to set'}</Text>
            </TouchableOpacity>
            {editInspectionDueDate && (
              <TouchableOpacity className="mb-2" onPress={() => { setEditInspectionDueDate(null); setShowEditInspectionDatePicker(false); }}>
                <Text className="text-blue-600 dark:text-[#0a84ff] text-sm">Clear date override</Text>
              </TouchableOpacity>
            )}
            {showEditInspectionDatePicker && editInspectionDueDate && (
              <DateTimePicker
                value={editInspectionDueDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setEditInspectionDueDate(selected); }}
              />
            )}
            <View className="mb-4" />

            <TouchableOpacity className="bg-blue-600 rounded-xl py-4 items-center mb-3" onPress={handleSaveInspectionEdit} disabled={savingInspectionEdit}>
              <Text className="text-white font-semibold text-base">{savingInspectionEdit ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => setEditInspectionVisible(false)}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Emissions Due Modal */}
      <Modal visible={editEmissionsVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Edit Emissions Test</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">Leave blank to use the automatic estimate.</Text>

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Due date (optional)</Text>
            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => {
                if (!editEmissionsDueDate) setEditEmissionsDueDate(new Date());
                setShowEditEmissionsDatePicker(!showEditEmissionsDatePicker);
              }}
            >
              <Text className="text-base text-gray-900 dark:text-white">{editEmissionsDueDate ? toDisplayDate(editEmissionsDueDate) : 'Auto — tap to set'}</Text>
            </TouchableOpacity>
            {editEmissionsDueDate && (
              <TouchableOpacity className="mb-2" onPress={() => { setEditEmissionsDueDate(null); setShowEditEmissionsDatePicker(false); }}>
                <Text className="text-blue-600 dark:text-[#0a84ff] text-sm">Clear date override</Text>
              </TouchableOpacity>
            )}
            {showEditEmissionsDatePicker && editEmissionsDueDate && (
              <DateTimePicker
                value={editEmissionsDueDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setEditEmissionsDueDate(selected); }}
              />
            )}
            <View className="mb-4" />

            <TouchableOpacity className="bg-blue-600 rounded-xl py-4 items-center mb-3" onPress={handleSaveEmissionsEdit} disabled={savingEmissionsEdit}>
              <Text className="text-white font-semibold text-base">{savingEmissionsEdit ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => setEditEmissionsVisible(false)}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 8: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: long-press service cards to edit due overrides and current mileage"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 2: Type-check the project**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors introduced by this work).

- [ ] **Step 3: Manual verification on the iOS simulator**

Run: `npx expo run:ios`

Then, after applying the migration to the connected Supabase project (`supabase db push` or the project's existing migration workflow):
- Long-press the **Oil Change** card → modal opens pre-filled with current mileage. Set a due-at mileage above current mileage → card shows "Due in N miles" (green/yellow), not overdue. Save persists across leaving and returning to the Home tab.
- Correct current mileage downward → the "overdue by N miles" example resolves.
- Long-press **Safety Inspection** and **Emissions Test** → set a future due date → card reflects it; set a past date → card shows overdue.
- Clear a date override → card reverts to the automatic estimate.
- Log a real oil change (Recent Service → +) → the oil override clears and the card recomputes from the new log.

---

## Notes for the implementer

- The migration must be applied to the live Supabase project before manual testing; unit tests (Task 3) need no database.
- `updateVehicle` already calls `.select().single()` and returns the updated row, which `scheduleMaintenanceNotifications` consumes — no extra refetch is needed for the card to update, since the hook also calls `setVehicle`.
- Do not touch `supabase/functions/daily-notifications/index.ts`; it is unused legacy and out of scope (see spec §"Notifications Consistency").
