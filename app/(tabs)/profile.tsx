import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, Switch, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicles } from '@/hooks/VehicleContext';
import { FormScrollView } from '@/components/FormScrollView';
import { VehicleForm, Field } from '@/components/VehicleForm';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { canSwitchVehicles } from '@/lib/vehicleSelection';

export default function ProfileScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme;
  const { session, signOut } = useAuth();
  const { vehicles, selectedVehicle, updateVehicle } = useVehicles();
  const multi = canSwitchVehicles(vehicles);

  async function handleThemeToggle(value: boolean) {
    const next = value ? 'dark' : 'light';
    setColorScheme(next);
    await AsyncStorage.setItem('colorScheme', next);
  }

  // Vehicles accordion (2+ vehicles). Collapses whenever a vehicle is added or removed.
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    setExpanded(false);
    setEditingId(null);
  }, [vehicles.length]);

  // Emissions settings apply to the selected vehicle.
  const [emissionsEnabled, setEmissionsEnabled] = useState(selectedVehicle?.emissions_enabled ?? false);
  const [emissionsInterval, setEmissionsInterval] = useState(selectedVehicle?.emissions_interval_months?.toString() ?? '24');
  useEffect(() => {
    setEmissionsEnabled(selectedVehicle?.emissions_enabled ?? false);
    setEmissionsInterval(selectedVehicle?.emissions_interval_months?.toString() ?? '24');
  }, [selectedVehicle?.id, selectedVehicle?.emissions_enabled, selectedVehicle?.emissions_interval_months]);

  async function handleEmissionsToggle(value: boolean) {
    if (!selectedVehicle) return;
    setEmissionsEnabled(value);
    try {
      await updateVehicle(selectedVehicle.id, { emissions_enabled: value });
    } catch (e: any) {
      setEmissionsEnabled(!value);
      Alert.alert('Error', e.message);
    }
  }

  async function handleEmissionsIntervalSave() {
    if (!selectedVehicle) return;
    const n = parseInt(emissionsInterval, 10);
    if (isNaN(n) || n < 1) {
      Alert.alert('Validation', 'Emissions interval must be a positive number.');
      setEmissionsInterval(selectedVehicle.emissions_interval_months?.toString() ?? '24');
      return;
    }
    if (n === selectedVehicle.emissions_interval_months) return;
    try {
      await updateVehicle(selectedVehicle.id, { emissions_interval_months: n });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const ordered = selectedVehicle
    ? [selectedVehicle, ...vehicles.filter(v => v.id !== selectedVehicle.id)]
    : vehicles;
  const iconColor = scheme === 'dark' ? '#8e8e93' : '#6b7280';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-black">
      <View className="bg-white dark:bg-[#1c1c1e] pt-16 pb-4 px-4 border-b border-gray-100 dark:border-[#2c2c2e]">
        <Text className="text-2xl font-bold dark:text-white">Profile</Text>
      </View>
    <FormScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-8">

      {vehicles.length === 0 && (
        <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
          <Text className="font-semibold text-gray-700 dark:text-white mb-4">Vehicle</Text>
          <VehicleForm vehicle={null} />
        </View>
      )}

      {vehicles.length === 1 && (
        <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
          <Text className="font-semibold text-gray-700 dark:text-white mb-1">Vehicle</Text>
          <VehicleForm key={vehicles[0].id} vehicle={vehicles[0]} lockable />
        </View>
      )}

      {multi && selectedVehicle && (
        <Animated.View layout={LinearTransition} style={{ marginBottom: 16 }}>
          <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4">
            <Pressable
              onPress={() => { setExpanded(e => !e); setEditingId(null); }}
              className="flex-row items-center justify-between"
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`Vehicles. Selected: ${vehicleDisplayName(selectedVehicle, vehicles)}`}
            >
              <View className="flex-1 mr-3">
                <Text className="text-xs font-semibold text-gray-500 dark:text-[#8e8e93] mb-0.5">VEHICLES</Text>
                <Text className="font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                  {vehicleDisplayName(selectedVehicle, vehicles)}
                </Text>
              </View>
              {expanded ? <ChevronUp size={20} color={iconColor} /> : <ChevronDown size={20} color={iconColor} />}
            </Pressable>

            {expanded && (
              <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
                {ordered.map(v => (
                  <View key={v.id} className="pt-3 mt-3 border-t border-gray-100 dark:border-[#3a3a3c]">
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 mr-3 text-gray-900 dark:text-white" numberOfLines={1}>
                        {vehicleDisplayName(v, vehicles)}
                        {v.id === selectedVehicle.id ? <Text className="text-gray-400 dark:text-[#636366]">  · on Home</Text> : null}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setEditingId(id => (id === v.id ? null : v.id))}
                        className="px-3 py-1 rounded-full bg-gray-100 dark:bg-[#3a3a3c]"
                        accessibilityRole="button"
                        accessibilityLabel={`${editingId === v.id ? 'Close' : 'Edit'} ${vehicleDisplayName(v, vehicles)}`}
                      >
                        <Text className="text-sm font-medium text-blue-600 dark:text-[#0a84ff]">{editingId === v.id ? 'Done' : 'Edit'}</Text>
                      </TouchableOpacity>
                    </View>
                    {editingId === v.id && (
                      <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginTop: 16 }}>
                        <VehicleForm
                          key={v.id}
                          vehicle={v}
                          onSaved={() => setEditingId(null)}
                          onDeleted={() => setEditingId(null)}
                        />
                      </Animated.View>
                    )}
                  </View>
                ))}
              </Animated.View>
            )}
          </View>
        </Animated.View>
      )}

      {vehicles.length > 0 && (
        <TouchableOpacity
          className="flex-row items-center justify-center bg-blue-600 rounded-xl py-3 mb-4"
          onPress={() => router.push('/vehicle/new')}
          accessibilityRole="button"
        >
          <Plus size={18} color="#ffffff" />
          <Text className="text-white font-semibold ml-1.5">Add Vehicle</Text>
        </TouchableOpacity>
      )}

      {selectedVehicle && (
        <View className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-4">
          <Text className="font-semibold text-gray-700 dark:text-white mb-4">
            Emissions Inspection{multi ? ` — ${vehicleDisplayName(selectedVehicle, vehicles)}` : ''}
          </Text>
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
              onEndEditing={handleEmissionsIntervalSave}
            />
          )}
        </View>
      )}

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
    </FormScrollView>
    </View>
  );
}
