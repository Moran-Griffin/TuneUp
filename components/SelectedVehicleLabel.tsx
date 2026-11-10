import { Text } from 'react-native';
import { useVehicles } from '@/hooks/VehicleContext';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { canSwitchVehicles } from '@/lib/vehicleSelection';

/** Gray subtitle naming the selected vehicle; renders nothing with a single vehicle. */
export function SelectedVehicleLabel({ className = '' }: { className?: string }) {
  const { vehicles, selectedVehicle } = useVehicles();
  if (!selectedVehicle || !canSwitchVehicles(vehicles)) return null;
  return (
    <Text className={`text-gray-500 dark:text-[#8e8e93] ${className}`} numberOfLines={1}>
      {vehicleDisplayName(selectedVehicle, vehicles)}
    </Text>
  );
}
