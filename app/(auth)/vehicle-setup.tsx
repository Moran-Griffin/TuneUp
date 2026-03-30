import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function VehicleSetupScreen() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [lastOilDate, setLastOilDate] = useState('');
  const [lastOilMileage, setLastOilMileage] = useState('');
  const [lastInspectionDate, setLastInspectionDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!make || !model || !year || !mileage) {
      Alert.alert('Error', 'Make, model, year, and mileage are required.');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('vehicles').insert({
      user_id: user.id,
      make,
      model,
      year,
      current_mileage: parseInt(mileage, 10),
      last_oil_change_date: lastOilDate || null,
      last_oil_change_mileage: lastOilMileage ? parseInt(lastOilMileage, 10) : null,
      last_inspection_date: lastInspectionDate || null,
    });
    setLoading(false);

    if (error) { Alert.alert('Error', error.message); return; }
    router.replace('/(tabs)');
  }

  const Field = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 mb-1">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 pt-16 pb-8">
      <Text className="text-2xl font-bold mb-1">Your Vehicle</Text>
      <Text className="text-gray-500 mb-6">Enter your car's details to get started</Text>

      <Field label="Make *" value={make} onChangeText={setMake} placeholder="e.g. Toyota" />
      <Field label="Model *" value={model} onChangeText={setModel} placeholder="e.g. Camry" />
      <Field label="Year *" value={year} onChangeText={setYear} placeholder="e.g. 2020" keyboardType="numeric" />
      <Field label="Current Mileage *" value={mileage} onChangeText={setMileage} placeholder="e.g. 45000" keyboardType="numeric" />

      <Text className="text-sm font-semibold text-gray-400 uppercase mb-3 mt-2">Optional — helps track upcoming service</Text>
      <Field label="Last Oil Change Date (YYYY-MM-DD)" value={lastOilDate} onChangeText={setLastOilDate} placeholder="e.g. 2025-09-15" />
      <Field label="Last Oil Change Mileage" value={lastOilMileage} onChangeText={setLastOilMileage} placeholder="e.g. 42000" keyboardType="numeric" />
      <Field label="Last Inspection Date (YYYY-MM-DD)" value={lastInspectionDate} onChangeText={setLastInspectionDate} placeholder="e.g. 2025-03-01" />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center mt-4"
        onPress={handleSave}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? 'Saving...' : 'Get Started'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
