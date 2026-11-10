import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Lock, Unlock } from 'lucide-react-native';
import { useVehicles } from '@/hooks/VehicleContext';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { Vehicle } from '@/types';

export function Field({ label, value, onChangeText, keyboardType = 'default', locked, placeholder, onEndEditing }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  locked?: boolean;
  placeholder?: string;
  onEndEditing?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base ${locked ? 'border-gray-200 dark:border-[#3a3a3c] bg-gray-50 dark:bg-[#1c1c1e] text-gray-400 dark:text-[#636366]' : 'border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white'}`}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={!locked}
        placeholder={placeholder}
        placeholderTextColor={colorScheme === 'dark' ? '#636366' : '#9ca3af'}
        onEndEditing={onEndEditing}
      />
    </View>
  );
}

type FormState = {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
  oilMiles: string;
  oilMonths: string;
  inspectionMonths: string;
};

function stateFrom(v: Vehicle | null): FormState {
  return {
    nickname: v?.nickname ?? '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    year: v?.year ?? '',
    mileage: v?.current_mileage?.toString() ?? '',
    oilMiles: v?.oil_change_interval_miles?.toString() ?? '5000',
    oilMonths: v?.oil_change_interval_months?.toString() ?? '4',
    inspectionMonths: v?.inspection_interval_months?.toString() ?? '12',
  };
}

function isComplete(v: Vehicle | null): boolean {
  return !!(v && v.make && v.model && v.year && v.current_mileage);
}

interface Props {
  /** Vehicle to edit, or null to create a new one. Remount (key) when switching vehicles. */
  vehicle: Vehicle | null;
  onSaved?: (v: Vehicle) => void;
  onDeleted?: () => void;
  /** Start locked when the vehicle is complete, with an Unlock toggle (Profile behavior). */
  lockable?: boolean;
}

export function VehicleForm({ vehicle, onSaved, onDeleted, lockable }: Props) {
  const { colorScheme: scheme } = useColorScheme();
  const { vehicles, createVehicle, updateVehicle, deleteVehicle } = useVehicles();
  const [form, setForm] = useState<FormState>(() => stateFrom(vehicle));
  const [locked, setLocked] = useState(!!lockable && isComplete(vehicle));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState) => (value: string) => setForm(f => ({ ...f, [k]: value }));

  // Reset unsaved edits when returning to the screen while unlocked; keep mileage fresh while locked.
  useFocusEffect(useCallback(() => {
    if (!vehicle) return;
    if (locked) setForm(f => ({ ...f, mileage: vehicle.current_mileage?.toString() ?? '' }));
    else setForm(stateFrom(vehicle));
  }, [vehicle, locked]));

  function handleLockToggle() {
    if (locked) {
      Alert.alert('Unlock Fields', 'Are you sure you want to edit your vehicle info?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock', onPress: () => setLocked(false) },
      ]);
    } else {
      setLocked(true);
    }
  }

  async function handleSave() {
    const { make, model, year, mileage } = form;
    if (!make || !model || !year || !mileage) {
      Alert.alert('Validation', 'All fields are required.');
      return;
    }
    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum)) {
      Alert.alert('Validation', 'Mileage must be a number.');
      return;
    }
    const oilIntervalNum = parseInt(form.oilMiles, 10);
    if (isNaN(oilIntervalNum) || oilIntervalNum < 1) {
      Alert.alert('Validation', 'Oil change interval must be a positive number.');
      return;
    }
    const oilIntervalMonthsNum = parseInt(form.oilMonths, 10);
    if (isNaN(oilIntervalMonthsNum) || oilIntervalMonthsNum < 1) {
      Alert.alert('Validation', 'Oil change month interval must be a positive number.');
      return;
    }
    const inspectionIntervalNum = parseInt(form.inspectionMonths, 10);
    if (isNaN(inspectionIntervalNum) || inspectionIntervalNum < 1) {
      Alert.alert('Validation', 'Inspection interval must be a positive number.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        nickname: form.nickname.trim() || null,
        make, model, year,
        current_mileage: mileageNum,
        oil_change_interval_miles: oilIntervalNum,
        oil_change_interval_months: oilIntervalMonthsNum,
        inspection_interval_months: inspectionIntervalNum,
      };
      const saved = vehicle ? await updateVehicle(vehicle.id, data) : await createVehicle(data);
      if (lockable) setLocked(true);
      Alert.alert('Saved', vehicle ? 'Vehicle details updated.' : 'Vehicle added.');
      onSaved?.(saved);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!vehicle) return;
    const name = vehicleDisplayName(vehicle, vehicles);
    Alert.alert(
      'Delete Vehicle',
      `This will permanently delete:\n\n• ${name}\n• All of its service log entries and appointments\n\nYour account and other vehicles are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Vehicle',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicle.id);
              onDeleted?.();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  const showLock = !!lockable && isComplete(vehicle);

  return (
    <View>
      {showLock && (
        <View className="flex-row justify-end mb-3">
          <TouchableOpacity onPress={handleLockToggle} className="flex-row items-center gap-1.5">
            {locked
              ? <><Lock size={15} color={scheme === 'dark' ? '#636366' : '#6b7280'} /><Text className="text-sm text-gray-500 dark:text-[#636366]">Locked</Text></>
              : <><Unlock size={15} color={scheme === 'dark' ? '#0a84ff' : '#2563eb'} /><Text className="text-sm text-blue-600 dark:text-[#0a84ff]">Unlocked</Text></>
            }
          </TouchableOpacity>
        </View>
      )}
      <Field label="Nickname (optional)" value={form.nickname} onChangeText={set('nickname')} locked={locked} placeholder="e.g. Dad's truck" />
      <Field label="Make" value={form.make} onChangeText={set('make')} locked={locked} />
      <Field label="Model" value={form.model} onChangeText={set('model')} locked={locked} />
      <Field label="Year" value={form.year} onChangeText={set('year')} keyboardType="numeric" locked={locked} />
      <Field label="Current Mileage" value={form.mileage} onChangeText={set('mileage')} keyboardType="numeric" locked={locked} />
      <Field label="Oil Change Interval (miles)" value={form.oilMiles} onChangeText={set('oilMiles')} keyboardType="numeric" locked={locked} />
      <Field label="Oil Change Interval (months)" value={form.oilMonths} onChangeText={set('oilMonths')} keyboardType="numeric" locked={locked} />
      <Field label="Safety Inspection Interval (months)" value={form.inspectionMonths} onChangeText={set('inspectionMonths')} keyboardType="numeric" locked={locked} />
      {!locked && (
        <TouchableOpacity className="bg-blue-600 rounded-xl py-3 items-center mt-2" onPress={handleSave} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? 'Saving...' : vehicle ? 'Save Changes' : 'Add Vehicle'}</Text>
        </TouchableOpacity>
      )}
      {vehicle && (
        <TouchableOpacity className="items-center mt-4" onPress={handleDelete} accessibilityRole="button">
          <Text className="text-red-500 dark:text-[#ff453a] font-medium">Delete This Vehicle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
