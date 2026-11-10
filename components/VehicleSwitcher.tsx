import { View, Text } from 'react-native';
import { MenuView, MenuAction } from '@react-native-menu/menu';
import { ChevronDown } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useVehicles } from '@/hooks/VehicleContext';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { canSwitchVehicles } from '@/lib/vehicleSelection';

const ALL_ID = 'all';

interface Props {
  title: string;
  subtitle?: string;
}

/** Home header title. With 2+ vehicles it opens a native menu: All vehicles + each car. */
export function VehicleSwitcher({ title, subtitle }: Props) {
  const { colorScheme } = useColorScheme();
  const { vehicles, selectedId, homeView, selectVehicle, setHomeView } = useVehicles();

  const titleText = (
    <Text className="text-2xl font-bold dark:text-white flex-shrink" numberOfLines={1}>{title}</Text>
  );
  const subtitleText = subtitle
    ? <Text className="text-gray-500 dark:text-[#8e8e93]">{subtitle}</Text>
    : null;

  if (!canSwitchVehicles(vehicles)) {
    return <View>{titleText}{subtitleText}</View>;
  }

  const actions: MenuAction[] = [
    { id: ALL_ID, title: 'All vehicles', state: homeView === 'overview' ? 'on' : 'off' },
    ...vehicles.map(v => ({
      id: v.id,
      title: vehicleDisplayName(v, vehicles),
      state: (homeView === 'detail' && v.id === selectedId ? 'on' : 'off') as 'on' | 'off',
    })),
  ];

  return (
    <View>
      <MenuView
        actions={actions}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === ALL_ID) {
            setHomeView('overview');
          } else {
            selectVehicle(nativeEvent.event);
            setHomeView('detail');
          }
        }}
      >
        <View
          className="flex-row items-center self-start"
          accessibilityRole="button"
          accessibilityLabel={`${title}. Switch vehicle`}
        >
          {titleText}
          <ChevronDown size={22} color={colorScheme === 'dark' ? '#ffffff' : '#111827'} style={{ marginLeft: 6 }} />
        </View>
      </MenuView>
      {subtitleText}
    </View>
  );
}
