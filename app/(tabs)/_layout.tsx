import { Tabs } from 'expo-router';
import { Home, Wrench, Calendar, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dark ? '#0a84ff' : '#2563eb',
        tabBarInactiveTintColor: dark ? '#636366' : '#6b7280',
        tabBarStyle: {
          backgroundColor: dark ? '#1c1c1e' : '#ffffff',
          borderTopColor: dark ? '#2c2c2e' : '#f3f4f6',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ color }) => <Wrench size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }}
      />
    </Tabs>
  );
}
