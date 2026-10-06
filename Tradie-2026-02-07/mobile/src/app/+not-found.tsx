import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-bg px-8">
        <Text className="text-fg text-[20px] font-semibold text-center">This page doesn’t exist.</Text>
        <Link href="/" className="mt-2 min-h-[44px] py-3">
          <Text className="text-link text-base font-semibold">Go to Home</Text>
        </Link>
      </View>
    </>
  );
}
