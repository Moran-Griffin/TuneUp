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
import { scheduleMaintenanceNotifications } from '@/lib/notifications';
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

function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

type PromptItem = { title: string; message: string; onEnter: () => void };

export default function HomeScreen() {
  const { colorScheme: scheme } = useColorScheme();
  const { session } = useAuth();
  const { vehicle, loading: vehicleLoading, refetch: refetchVehicle, updateVehicle } = useVehicle(session?.user.id);
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

  function openOilEdit() {
    if (!vehicle) return;
    setSavingOilEdit(false);
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
      if (isNaN(dm) || dm <= 0) {
        Alert.alert('Validation', 'Due mileage must be a positive number.');
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
    setSavingInspectionEdit(false);
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
    setSavingEmissionsEdit(false);
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
            onLongPress={openOilEdit}
          />
          <ServiceDueCard
            title="Safety Inspection"
            status={inspectionStatus}
            onSchedule={() => router.push({ pathname: '/(tabs)/schedule', params: { tab: 'shops' } })}
            onNoRecord={!vehicle.last_inspection_date ? () => setInspectionModalVisible(true) : undefined}
            noRecordLabel="Log Inspection Date"
            isScheduled={scheduledTypes.has('inspection')}
            scheduledDate={scheduledDates.get('inspection')}
            onLongPress={openInspectionEdit}
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
              onLongPress={openEmissionsEdit}
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
                setShowEditOilDatePicker((prev) => !prev);
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
                setShowEditInspectionDatePicker((prev) => !prev);
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
                setShowEditEmissionsDatePicker((prev) => !prev);
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
    </>
  );
}
