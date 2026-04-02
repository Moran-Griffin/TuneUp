import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Lock, Unlock } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';

function Field({ label, value, onChangeText, keyboardType = 'default', locked }: any) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base ${locked ? 'border-gray-200 dark:border-[#3a3a3c] bg-gray-50 dark:bg-[#1c1c1e] text-gray-400 dark:text-[#636366]' : 'border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white'}`}
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
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme;
  const { session, signOut } = useAuth();

  async function handleThemeToggle(value: boolean) {
    const next = value ? 'dark' : 'light';
    setColorScheme(next);
    await AsyncStorage.setItem('colorScheme', next);
  }
  const { vehicle, updateVehicle, createVehicle, deleteVehicle } = useVehicle(session?.user.id);

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

  function handleDeleteData() {
    Alert.alert(
      'Delete Vehicle Data',
      'This will permanently delete:\n\n• Your vehicle (make, model, year, mileage)\n• All service log entries\n• All scheduled appointments\n\nYour account and login will be kept — you can set up a new vehicle afterwards.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle();
              setMake('');
              setModel('');
              setYear('');
              setMileage('');
              setOilChangeInterval('5000');
              setInspectionInterval('12');
              setEmissionsEnabled(false);
              setEmissionsInterval('24');
              setLocked(false);
              initialized.current = false;
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
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
    <View className="flex-1 bg-gray-50 dark:bg-black">
      <View className="bg-white dark:bg-[#1c1c1e] pt-16 pb-4 px-4 border-b border-gray-100 dark:border-[#2c2c2e]">
        <Text className="text-2xl font-bold dark:text-white">Profile</Text>
      </View>
    <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-8">

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="font-semibold text-gray-700 dark:text-white">Vehicle</Text>
          {canLock && (
            <TouchableOpacity onPress={handleLockToggle} className="flex-row items-center gap-1.5">
              {locked
                ? <><Lock size={15} color={scheme === 'dark' ? '#636366' : '#6b7280'} /><Text className="text-sm text-gray-500 dark:text-[#636366]">Locked</Text></>
                : <><Unlock size={15} color={scheme === 'dark' ? '#0a84ff' : '#2563eb'} /><Text className="text-sm text-blue-600 dark:text-[#0a84ff]">Unlocked</Text></>
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

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 dark:text-white mb-4">Emissions Inspection</Text>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-4">
            <Text className="text-sm font-medium text-gray-900 dark:text-white">Track Emissions Tests</Text>
            <Text className="text-xs text-gray-500 dark:text-[#8e8e93] mt-0.5">Enable if your state requires periodic emissions testing</Text>
          </View>
          <Switch
            value={emissionsEnabled}
            onValueChange={handleEmissionsToggle}
            trackColor={{ false: '#d1d5db', true: '#0a84ff' }}
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

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 dark:text-white mb-4">Appearance</Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-4">
            <Text className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</Text>
          </View>
          <Switch
            value={scheme === 'dark'}
            onValueChange={handleThemeToggle}
            trackColor={{ false: '#d1d5db', true: '#0a84ff' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 dark:text-white mb-3">Notifications</Text>
        <Text className="text-sm text-gray-500 dark:text-[#8e8e93] mb-2">
          Maintenance reminders and monthly mileage prompts are sent automatically.
          Location-based prompts require "Always" location permission in iOS Settings.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('app-settings:')}
          className="mt-1"
        >
          <Text className="text-blue-600 dark:text-[#0a84ff] text-sm">Open iOS Settings →</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 dark:text-white mb-2">Account</Text>
        <Text className="text-gray-500 dark:text-[#8e8e93] text-sm mb-4">{session?.user.email}</Text>
        <TouchableOpacity onPress={signOut}>
          <Text className="text-red-500 dark:text-[#ff453a] font-medium">Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 dark:text-white mb-1">Reset Vehicle Data</Text>
        <Text className="text-xs text-gray-500 dark:text-[#8e8e93] mb-3">Usage will clear all data in your account.</Text>
        <TouchableOpacity onPress={handleDeleteData} disabled={!vehicle}>
          <Text className={`font-medium ${vehicle ? 'text-red-500 dark:text-[#ff453a]' : 'text-gray-300 dark:text-[#48484a]'}`}>Delete Vehicle &amp; All Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
}
