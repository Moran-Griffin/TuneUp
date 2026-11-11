import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Search } from 'lucide-react-native';
import { useShopSearch } from '@/hooks/useShopSearch';
import { ShopListItem } from '@/components/ShopListItem';
import { SHOP_CHIPS, filterShops } from '@/lib/shopSearch';

type Props = { finder: ReturnType<typeof useShopSearch> };

export function ShopFinder({ finder }: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [query, setQuery] = useState('');
  const { nearby, text, loading, refreshing, error, openingId, search, clearSearch, refresh, openShop } = finder;

  const trimmed = query.trim();
  // A submitted Google search shows its own results; anything else filters the nearby list as you type.
  const showingText = !!text && trimmed.toLowerCase() === text.label.toLowerCase();
  const shops = showingText ? text!.results : filterShops(nearby, query);

  function handleChange(v: string) {
    setQuery(v);
    if (!v.trim()) clearSearch();
  }

  function handleChip(label: string, q: string) {
    if (showingText && text!.label === label) {
      setQuery('');
      clearSearch();
      return;
    }
    setQuery(label);
    search(label, q);
  }

  const empty = trimmed
    ? showingText
      ? `No shops found for "${trimmed}". Try a different shop name or service.`
      : `No nearby shops match "${trimmed}". Press Search on the keyboard to look further.`
    : 'No shops found nearby. Pull down to try again.';

  return (
    <View className="flex-1">
      <View className="bg-white dark:bg-[#1c1c1e] px-4 pt-3 pb-2 border-b border-gray-100 dark:border-[#2c2c2e]">
        <View className="flex-row items-center bg-gray-100 dark:bg-[#2c2c2e] rounded-xl px-3">
          <Search size={16} color={dark ? '#8e8e93' : '#6b7280'} />
          <TextInput
            className="flex-1 py-2.5 ml-2 text-base text-gray-900 dark:text-white"
            value={query}
            onChangeText={handleChange}
            onSubmitEditing={() => search(trimmed)}
            placeholder="Shop name or service"
            placeholderTextColor={dark ? '#636366' : '#9ca3af'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            accessibilityLabel="Search shops"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" keyboardShouldPersistTaps="handled">
          {SHOP_CHIPS.map(c => {
            const active = showingText && text!.label === c.label;
            return (
              <TouchableOpacity
                key={c.label}
                onPress={() => handleChip(c.label, c.query)}
                className={`px-3 py-1.5 rounded-full mr-2 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text className={`text-sm ${active ? 'text-white font-medium' : 'text-gray-700 dark:text-[#d1d1d6]'}`}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={item => item.place_id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={dark ? '#8e8e93' : undefined} />}
          ListHeaderComponent={error && shops.length > 0
            ? <Text className="text-red-400 dark:text-[#ff453a] text-center text-sm px-4 py-2">{error}</Text>
            : null}
          renderItem={({ item }) => (
            <ShopListItem shop={item} opening={openingId === item.place_id} onPress={() => openShop(item)} />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center px-8 pt-16">
              {error
                ? <Text className="text-red-400 dark:text-[#ff453a] text-center">{error}</Text>
                : <Text className="text-gray-400 dark:text-[#636366] text-center">{empty}</Text>}
            </View>
          }
        />
      )}
    </View>
  );
}
