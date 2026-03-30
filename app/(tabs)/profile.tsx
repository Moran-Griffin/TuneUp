import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { vehicle, updateVehicle } = useVehicle(session?.user.id);

  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ?? '');
  const [mileage, setMileage] = useState(vehicle?.current_mileage?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateVehicle({
        make,
        model,
        year,
        current_mileage: parseInt(mileage, 10),
      });
      Alert.alert('Saved', 'Vehicle details updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const Field = ({ label, value, onChangeText, keyboardType = 'default' }: any) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 mb-1">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-4 pt-16 pb-8">
      <Text className="text-2xl font-bold mb-6">Profile</Text>

      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="font-semibold text-gray-700 mb-4">Vehicle</Text>
        <Field label="Make" value={make} onChangeText={setMake} />
        <Field label="Model" value={model} onChangeText={setModel} />
        <Field label="Year" value={year} onChangeText={setYear} keyboardType="numeric" />
        <Field label="Current Mileage" value={mileage} onChangeText={setMileage} keyboardType="numeric" />
        <TouchableOpacity
          className="bg-blue-600 rounded-xl py-3 items-center mt-2"
          onPress={handleSave}
          disabled={saving}
        >
          <Text className="text-white font-semibold">{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
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
