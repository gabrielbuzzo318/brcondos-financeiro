import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { getCurrentUser, hasSession } from '@/src/lib/api';
import { colors } from '@/src/theme';

export default function Index() {
  useEffect(() => {
    (async () => {
      try {
        if (!(await hasSession())) return router.replace('/login');
        await getCurrentUser();
        router.replace('/(tabs)/inicio');
      } catch {
        router.replace('/login');
      }
    })();
  }, []);

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
}
