import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useVehicles } from '@/hooks/VehicleContext';
import { VehicleSwitcher } from '@/components/VehicleSwitcher';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';
import { statusTone, StatusTone } from '@/lib/serviceCardLabels';
import { ServiceStatus } from '@/types';

// Palette matches ServiceDueCard.
const TONE: Record<StatusTone | 'off', { chip: string; dot: string; text: string; label: string }> = {
  red: { chip: 'bg-red-50 dark:bg-[#2c1516] border-red-200 dark:border-[#5c2323]', dot: '#ef4444', text: 'text-gray-900 dark:text-white', label: 'Overdue' },
  yellow: { chip: 'bg-yellow-50 dark:bg-[#2a2310] border-yellow-200 dark:border-[#574a1a]', dot: '#f59e0b', text: 'text-gray-900 dark:text-white', label: 'Due soon' },
  green: { chip: 'bg-green-50 dark:bg-[#0d2418] border-green-200 dark:border-[#1a4a2e]', dot: '#22c55e', text: 'text-gray-900 dark:text-white', label: 'Up to date' },
  off: { chip: 'bg-gray-50 dark:bg-[#1c1c1e] border-gray-200 dark:border-[#3a3a3c]', dot: '#9ca3af', text: 'text-gray-400 dark:text-[#636366]', label: 'Off' },
};

function StatusChip({ label, status }: { label: string; status: ServiceStatus | null }) {
  const tone = status ? statusTone(status) : 'off';
  const t = TONE[tone];
  return (
    <View
      className={`flex-1 flex-row items-center justify-center border rounded-full px-2 py-1.5 ${t.chip}`}
      accessibilityLabel={`${label}: ${t.label}`}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.dot, marginRight: 6 }} />
      <Text className={`text-xs font-medium ${t.text}`} numberOfLines={1}>{status ? label : `${label}: Off`}</Text>
    </View>
  );
}

/** "All vehicles" view on Home: one status card per vehicle. */
export function VehicleOverview() {
  const { vehicles, selectVehicle, setHomeView } = useVehicles();

  return (
    <>
      <View className="bg-white dark:bg-[#1c1c1e] pt-16 pb-4 px-4 border-b border-gray-100 dark:border-[#2c2c2e]">
        <VehicleSwitcher title="All vehicles" subtitle={`${vehicles.length} vehicles`} />
      </View>
      <ScrollView className="flex-1 bg-gray-50 dark:bg-black" contentContainerClassName="px-4 pt-4 pb-8">
        {vehicles.map(v => (
          <TouchableOpacity
            key={v.id}
            className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 mb-3"
            onPress={() => { selectVehicle(v.id); setHomeView('detail'); }}
            accessibilityRole="button"
          >
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{vehicleDisplayName(v, vehicles)}</Text>
            <Text className="text-gray-500 dark:text-[#8e8e93] mb-3">{v.current_mileage.toLocaleString()} miles</Text>
            <View className="flex-row gap-2">
              <StatusChip label="Oil" status={getOilChangeStatus(v)} />
              <StatusChip label="Inspection" status={getInspectionStatus(v)} />
              <StatusChip label="Emissions" status={v.emissions_enabled ? getEmissionsStatus(v) : null} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}
