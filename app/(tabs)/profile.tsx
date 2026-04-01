import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Lock, Unlock } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';

function Field({ label, value, onChangeText, keyboardType = 'default', locked }: any) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 mb-1">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base ${locked ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300 text-gray-900'}`}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={!locked}
      />
    </View>
  );
}

function vehicleIsComplete(make: string, model: string, year: string, mileage: string) {
  return !!(make && model && year && mileage);
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { vehicle, updateVehicle, createVehicle } = useVehicle(session?.user.id);

  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ?? '');
  const [mileage, setMileage] = useState(vehicle?.current_mileage?.toString() ?? '');
  const [oilChangeInterval, setOilChangeInterval] = useState(vehicle?.oil_change_interval_miles?.toString() ?? '5000');
  const [inspectionInterval, setInspectionInterval] = useState(vehicle?.inspection_interval_months?.toString() ?? '12');
  const [emissionsEnabled, setEmissionsEnabled] = useState(vehicle?.emissions_enabled ?? false);
  const [emissionsInterval, setEmissionsInterval] = useState(vehicle?.emissions_interval_months?.toString() ?? '24');
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (vehicle && !initialized.current) {
      setMake(vehicle.make ?? '');
      setModel(vehicle.model ?? '');
      setYear(vehicle.year ?? '');
      setMileage(vehicle.current_mileage?.toString() ?? '');
      setOilChangeInterval(vehicle.oil_change_interval_miles?.toString() ?? '5000');
      setInspectionInterval(vehicle.inspection_interval_months?.toString() ?? '12');
      setEmissionsEnabled(vehicle.emissions_enabled ?? false);
      setEmissionsInterval(vehicle.emissions_interval_months?.toString() ?? '24');
      if (vehicle.make && vehicle.model && vehicle.year && vehicle.current_mileage) {
        setLocked(true);
      }
      initialized.current = true;
    } else if (vehicle && locked) {
      setMileage(vehicle.current_mileage?.toString() ?? '');
    }
  }, [vehicle, locked]);

  // Reset unsaved edits when navigating back to this screen while unlocked
  useFocusEffect(useCallback(() => {
    if (!vehicle || locked) return;
    setMake(vehicle.make ?? '');
    setModel(vehicle.model ?? '');
    setYear(vehicle.year ?? '');
    setMileage(vehicle.current_mileage?.toString() ?? '');
    setOilChangeInterval(vehicle.oil_change_interval_miles?.toString() ?? '5000');
    setInspectionInterval(vehicle.inspection_interval_months?.toString() ?? '12');
    setEmissionsInterval(vehicle.emissions_interval_months?.toString() ?? '24');
  }, [vehicle, locked]));

  function handleLockToggle() {
    if (locked) {
      Alert.alert(
        'Unlock Fields',
        'Are you sure you want to edit your vehicle info?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unlock', onPress: () => setLocked(false) },
        ]
      );
    } else {
      setLocked(true);
    }
  }

  async function handleEmissionsToggle(value: boolean) {
    setEmissionsEnabled(value);
    try {
      await updateVehicle({ emissions_enabled: value });
    } catch (e: any) {
      setEmissionsEnabled(!value);
      Alert.alert('Error', e.message);
    }
  }

  async function handleSave() {
    if (!make || !model || !year || !mileage) {
      Alert.alert('Validation', 'All fields are required.');
      return;
    }
    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum)) {
      Alert.alert('Validation', 'Mileage must be a number.');
      return;
    }
    const oilIntervalNum = parseInt(oilChangeInterval, 10);
    if (isNaN(oilIntervalNum) || oilIntervalNum < 1) {
      Alert.alert('Validation', 'Oil change interval must be a positive number.');
      return;
    }
    const inspectionIntervalNum = parseInt(inspectionInterval, 10);
    if (isNaN(inspectionIntervalNum) || inspectionIntervalNum < 1) {
      Alert.alert('Validation', 'Inspection interval must be a positive number.');
      return;
    }
    const emissionsIntervalNum = parseInt(emissionsInterval, 10);
    if (isNaN(emissionsIntervalNum) || emissionsIntervalNum < 1) {
      Alert.alert('Validation', 'Emissions interval must be a positive number.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        make, model, year, current_mileage: mileageNum,
        oil_change_interval_miles: oilIntervalNum,
        inspection_interval_months: inspectionIntervalNum,
        emissions_interval_months: emissionsIntervalNum,
      };
      if (vehicle) {
        await updateVehicle(data);
      } else {
        await createVehicle(data);
      }
      setLocked(true);
      Alert.alert('Saved', 'Vehicle details updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const canLock = vehicleIsComplete(make, model, year, mileage);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-4 pt-16 pb-8">
      <Text className="text-2xl font-bold mb-6">Profile</Text>

      <View className="bg-white rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-semibold text-gray-700">Vehicle</Text>
          {canLock && (
            <TouchableOpacity onPress={handleLockToggle} className="flex-row items-center gap-1.5">
              {locked
                ? <><Lock size={15} color="#6b7280" /><Text className="text-sm text-gray-500">Locked</Text></>
                : <><Unlock size={15} color="#2563eb" /><Text className="text-sm text-blue-600">Unlocked</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
        <Field label="Make" value={make} onChangeText={setMake} locked={locked} />
        <Field label="Model" value={model} onChangeText={setModel} locked={locked} />
        <Field label="Year" value={year} onChangeText={setYear} keyboardType="numeric" locked={locked} />
        <Field label="Current Mileage" value={mileage} onChangeText={setMileage} keyboardType="numeric" locked={locked} />
        <Field label="Oil Change Interval (miles)" value={oilChangeInterval} onChangeText={setOilChangeInterval} keyboardType="numeric" locked={locked} />
        <Field label="Safety Inspection Interval (months)" value={inspectionInterval} onChangeText={setInspectionInterval} keyboardType="numeric" locked={locked} />
        {!locked && (
          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-3 items-center mt-2"
            onPress={handleSave}
            disabled={saving}
          >
            <Text className="text-white font-semibold">{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 mb-4">Emissions Inspection</Text>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-4">
            <Text className="text-sm font-medium text-gray-900">Track Emissions Tests</Text>
            <Text className="text-xs text-gray-500 mt-0.5">Enable if your state requires periodic emissions testing</Text>
          </View>
          <Switch
            value={emissionsEnabled}
            onValueChange={handleEmissionsToggle}
            trackColor={{ false: '#d1d5db', true: '#2563eb' }}
            thumbColor="#ffffff"
          />
        </View>
        {emissionsEnabled && (
          <Field
            label="Emissions Test Interval (months)"
            value={emissionsInterval}
            onChangeText={setEmissionsInterval}
            keyboardType="numeric"
            locked={locked}
          />
        )}
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 mb-3">Notifications</Text>
        <Text className="text-sm text-gray-500 mb-2">
          Maintenance reminders and monthly mileage prompts are sent automatically.
          Location-based prompts require "Always" location permission in iOS Settings.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('app-settings:')}
          className="mt-1"
        >
          <Text className="text-blue-600 text-sm">Open iOS Settings →</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 mb-2">Account</Text>
        <Text className="text-gray-500 text-sm mb-4">{session?.user.email}</Text>
        <TouchableOpacity onPress={signOut}>
          <Text className="text-red-500 font-medium">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
