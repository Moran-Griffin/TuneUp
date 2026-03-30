import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import '../global.css';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const hasOpenedBrowser = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/welcome');
    }
  }, [session, loading]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
