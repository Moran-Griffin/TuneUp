import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, TextInput } from 'react-native';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { useAppointments } from '@/hooks/useAppointments';
import { ServiceDueCard } from '@/components/ServiceDueCard';
import { LogEntryItem } from '@/components/LogEntryItem';
import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';
import { ServiceType } from '@/types';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDisplayDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

type PromptItem = { title: string; message: string; onEnter: () => void };

export default function HomeScreen() {
  const { colorScheme: scheme } = useColorScheme();
  const { session } = useAuth();
  const { vehicle, loading: vehicleLoading, refetch: refetchVehicle } = useVehicle(session?.user.id);
  const { logs, loading: logsLoading, refetch: refetchLogs, addLog } = useMaintenanceLogs(vehicle?.id, vehicle);
  const { appointments, refetch: refetchAppointments } = useAppointments(vehicle?.id);

  // Oil change modal
  const [oilModalVisible, setOilModalVisible] = useState(false);
  const [oilDate, setOilDate] = useState(new Date());
  const [showOilDatePicker, setShowOilDatePicker] = useState(false);
  const [oilMileage, setOilMileage] = useState('');
  const [savingOil, setSavingOil] = useState(false);

  // Inspection modal
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [inspectionDate, setInspectionDate] = useState(new Date());
  const [showInspectionDatePicker, setShowInspectionDatePicker] = useState(false);
  const [savingInspection, setSavingInspection] = useState(false);

  // Emissions modal
  const [emissionsModalVisible, setEmissionsModalVisible] = useState(false);
  const [emissionsDate, setEmissionsDate] = useState(new Date());
  const [showEmissionsDatePicker, setShowEmissionsDatePicker] = useState(false);
  const [savingEmissions, setSavingEmissions] = useState(false);

  const promptedServices = useRef<Set<string>>(new Set());
  const prevEmissionsEnabled = useRef<boolean | undefined>(undefined);
  const promptQueue = useRef<PromptItem[]>([]);

  useFocusEffect(useCallback(() => {
    refetchVehicle();
    refetchLogs();
    refetchAppointments();
  }, [refetchVehicle, refetchLogs, refetchAppointments]));

  function showNextPrompt() {
    const next = promptQueue.current.shift();
    if (!next) return;
    Alert.alert(next.title, next.message, [
      { text: 'Not now', style: 'cancel', onPress: showNextPrompt },
      { text: 'Enter Date', onPress: next.onEnter },
    ]);
  }

  // Build and fire the prompt queue when vehicle loads or emissions is re-enabled
  useEffect(() => {
    if (!vehicle) return;

    // If emissions was just re-enabled, allow re-prompting for it
    if (prevEmissionsEnabled.current === false && vehicle.emissions_enabled) {
      promptedServices.current.delete('emissions');
    }
    prevEmissionsEnabled.current = vehicle.emissions_enabled;

    const queue: PromptItem[] = [];

    if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage && !promptedServices.current.has('oil')) {
      promptedServices.current.add('oil');
      queue.push({
        title: 'When was your last oil change?',
        message: 'We have no oil change on record. Would you like to enter it now?',
        onEnter: () => setOilModalVisible(true),
      });
    }
    if (!vehicle.last_inspection_date && !promptedServices.current.has('inspection')) {
      promptedServices.current.add('inspection');
      queue.push({
        title: 'When was your last safety inspection?',
        message: 'We have no inspection on record. Would you like to enter it now?',
        onEnter: () => setInspectionModalVisible(true),
      });
    }
    if (vehicle.emissions_enabled && !vehicle.last_emissions_date && !promptedServices.current.has('emissions')) {
      promptedServices.current.add('emissions');
      queue.push({
        title: 'When was your last emissions test?',
        message: 'We have no emissions test on record. Would you like to enter it now?',
        onEnter: () => setEmissionsModalVisible(true),
      });
    }

    if (queue.length === 0) return;
    const wasEmpty = promptQueue.current.length === 0;
    promptQueue.current.push(...queue);
    if (wasEmpty) showNextPrompt();
  }, [vehicle]);

  async function handleSaveOilDate() {
    setSavingOil(true);
    try {
      await addLog({
        type: 'oil_change',
        date: toDateString(oilDate),
        mileage: oilMileage ? parseInt(oilMileage, 10) : undefined,
      });
      setOilModalVisible(false);
      showNextPrompt();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingOil(false);
    }
  }

  async function handleSaveInspectionDate() {
    setSavingInspection(true);
    try {
      await addLog({ type: 'inspection', date: toDateString(inspectionDate) });
      setInspectionModalVisible(false);
      showNextPrompt();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingInspection(false);
    }
  }

  async function handleSaveEmissionsDate() {
    setSavingEmissions(true);
    try {
      await addLog({ type: 'emissions_inspection', date: toDateString(emissionsDate) });
      setEmissionsModalVisible(false);
      showNextPrompt();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingEmissions(false);
    }
  }

  if (vehicleLoading) {
    return <View className="flex-1 items-center justify-center"><Text className="text-gray-400">Loading...</Text></View>;
  }

  if (!vehicle) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-gray-400 text-center">No vehicle set up yet.</Text>
      </View>
    );
  }

  const oilStatus = getOilChangeStatus(vehicle);
  const inspectionStatus = getInspectionStatus(vehicle);
  const emissionsStatus = vehicle.emissions_enabled ? getEmissionsStatus(vehicle) : null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const futureLogs = logs.filter(l => l.date > todayStr);
  const recentLogs = logs.filter(l => l.date <= todayStr).slice(0, 5);
  const scheduledTypes = new Set<ServiceType>([
    ...appointments.map(a => a.service_type),
    ...futureLogs.map(l => l.type),
  ]);

  // Map service type → nearest upcoming date from appointments or future logs
  const scheduledDates = new Map<ServiceType, string>();
  for (const appt of appointments) {
    const existing = scheduledDates.get(appt.service_type);
    if (!existing || appt.scheduled_date < existing) {
      scheduledDates.set(appt.service_type, appt.scheduled_date);
    }
  }
  for (const log of futureLogs) {
    const existing = scheduledDates.get(log.type);
    if (!existing || log.date < existing) {
      scheduledDates.set(log.type, log.date);
    }
  }

  return (
    <>
      <View className="bg-white dark:bg-[#1c1c1e] pt-16 pb-4 px-4 border-b border-gray-100 dark:border-[#2c2c2e]">
        <Text className="text-2xl font-bold dark:text-white">{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text className="text-gray-500 dark:text-[#8e8e93]">{vehicle.current_mileage.toLocaleString()} miles</Text>
      </View>
      <ScrollView className="flex-1 bg-gray-50 dark:bg-black">

        <View className="px-4 pt-4">
          <Text className="font-semibold text-gray-700 dark:text-[#8e8e93] mb-3">Service Status</Text>
          <ServiceDueCard
            title="Oil Change"
            status={oilStatus}
            onSchedule={() => router.push({ pathname: '/(tabs)/schedule', params: { tab: 'shops' } })}
            onNoRecord={!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage ? () => setOilModalVisible(true) : undefined}
            noRecordLabel="Log Oil Change Date"
            isScheduled={scheduledTypes.has('oil_change')}
            scheduledDate={scheduledDates.get('oil_change')}
          />
          <ServiceDueCard
            title="Safety Inspection"
            status={inspectionStatus}
            onSchedule={() => router.push({ pathname: '/(tabs)/schedule', params: { tab: 'shops' } })}
            onNoRecord={!vehicle.last_inspection_date ? () => setInspectionModalVisible(true) : undefined}
            noRecordLabel="Log Inspection Date"
            isScheduled={scheduledTypes.has('inspection')}
            scheduledDate={scheduledDates.get('inspection')}
          />
          {vehicle.emissions_enabled && emissionsStatus && (
            <ServiceDueCard
              title="Emissions Test"
              status={emissionsStatus}
              onSchedule={() => router.push({ pathname: '/(tabs)/schedule', params: { tab: 'shops' } })}
              onNoRecord={!vehicle.last_emissions_date ? () => setEmissionsModalVisible(true) : undefined}
              isScheduled={scheduledTypes.has('emissions_inspection')}
              scheduledDate={scheduledDates.get('emissions_inspection')}
              noRecordLabel="Log Emissions Date"
            />
          )}
        </View>

        <View className="px-4 pt-2 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-gray-700 dark:text-[#8e8e93]">Recent Service</Text>
            <TouchableOpacity onPress={() => router.push('/log/new')}>
              <Plus size={20} color={scheme === 'dark' ? '#0a84ff' : '#2563eb'} />
            </TouchableOpacity>
          </View>
          {recentLogs.length === 0 && !logsLoading ? (
            <Text className="text-gray-400 dark:text-[#636366] text-center py-4">No service history yet</Text>
          ) : (
            recentLogs.map((log, i) => (
              <LogEntryItem
                key={log.id}
                log={log}
                onPress={() => router.push(`/log/${log.id}`)}
                isFirst={i === 0}
                isLast={i === recentLogs.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Oil Change Modal */}
      <Modal visible={oilModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Last Oil Change</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">When was your most recent oil change?</Text>

            <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Date</Text>
            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => setShowOilDatePicker(!showOilDatePicker)}
            >
              <Text className="text-base text-gray-900 dark:text-white">{toDisplayDate(oilDate)}</Text>
            </TouchableOpacity>
            {showOilDatePicker && (
              <DateTimePicker
                value={oilDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setOilDate(selected); }}
                maximumDate={new Date()}
              />
            )}
            <View className="mb-3" />

            <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Mileage at service (optional)</Text>
            <TextInput
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-6 text-base text-gray-900 dark:text-white"
              value={oilMileage}
              onChangeText={setOilMileage}
              placeholder="e.g. 33000"
              keyboardType="numeric"
            />

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-4 items-center mb-3"
              onPress={handleSaveOilDate}
              disabled={savingOil}
            >
              <Text className="text-white font-semibold text-base">
                {savingOil ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => { setOilModalVisible(false); showNextPrompt(); }}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Safety Inspection Modal */}
      <Modal visible={inspectionModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Last Safety Inspection</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">When was your most recent vehicle inspection?</Text>

            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => setShowInspectionDatePicker(!showInspectionDatePicker)}
            >
              <Text className="text-base text-gray-900 dark:text-white">{toDisplayDate(inspectionDate)}</Text>
            </TouchableOpacity>
            {showInspectionDatePicker && (
              <DateTimePicker
                value={inspectionDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setInspectionDate(selected); }}
                maximumDate={new Date()}
              />
            )}
            <View className="mb-6" />

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-4 items-center mb-3"
              onPress={handleSaveInspectionDate}
              disabled={savingInspection}
            >
              <Text className="text-white font-semibold text-base">
                {savingInspection ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => { setInspectionModalVisible(false); showNextPrompt(); }}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Emissions Modal */}
      <Modal visible={emissionsModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-[#1c1c1e] rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold dark:text-white mb-1">Last Emissions Test</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-5">When was your most recent emissions inspection?</Text>

            <TouchableOpacity
              className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
              onPress={() => setShowEmissionsDatePicker(!showEmissionsDatePicker)}
            >
              <Text className="text-base text-gray-900 dark:text-white">{toDisplayDate(emissionsDate)}</Text>
            </TouchableOpacity>
            {showEmissionsDatePicker && (
              <DateTimePicker
                value={emissionsDate}
                mode="date"
                display="inline"
                onChange={(_, selected) => { if (selected) setEmissionsDate(selected); }}
                maximumDate={new Date()}
              />
            )}
            <View className="mb-6" />

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-4 items-center mb-3"
              onPress={handleSaveEmissionsDate}
              disabled={savingEmissions}
            >
              <Text className="text-white font-semibold text-base">
                {savingEmissions ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center" onPress={() => { setEmissionsModalVisible(false); showNextPrompt(); }}>
              <Text className="text-gray-500 dark:text-[#8e8e93]">Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
