import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  /** Previously used names (see recentCustomLabels), shown as tappable chips. */
  suggestions: string[];
}

/** Optional custom name for an "Other" service entry. */
export function CustomLabelInput({ value, onChangeText, suggestions }: Props) {
  const { colorScheme } = useColorScheme();
  const visible = suggestions.filter(s => s.toLowerCase() !== value.trim().toLowerCase());
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Custom name (optional)</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 text-base text-gray-900 dark:text-white"
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. Wiper blades"
        placeholderTextColor={colorScheme === 'dark' ? '#636366' : '#9ca3af'}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      {visible.length > 0 && (
        <View className="flex-row flex-wrap mt-2">
          {visible.map(s => (
            <TouchableOpacity
              key={s}
              className="mr-2 mb-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-[#2c2c2e]"
              onPress={() => onChangeText(s)}
              accessibilityRole="button"
              accessibilityLabel={`Use name ${s}`}
            >
              <Text className="text-sm text-gray-600 dark:text-[#8e8e93]">{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
