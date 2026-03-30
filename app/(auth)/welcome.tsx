import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function WelcomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    setLoading(true);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else if (mode === 'signup') {
      router.replace('/(auth)/vehicle-setup');
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white justify-center px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text className="text-3xl font-bold mb-2">TuneUp</Text>
      <Text className="text-gray-500 mb-8">Track your vehicle maintenance</Text>

      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center mb-4"
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text className="text-center text-blue-600">
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
