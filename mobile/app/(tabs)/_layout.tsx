import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/src/theme';

const Icon = ({ emoji, color }: { emoji: string; color: string }) => <Text style={{ fontSize: 19, color }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 68, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: '#fff' },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }
    }}>
      <Tabs.Screen name="inicio" options={{ title:'Início', tabBarIcon:({color})=><Icon emoji="⌂" color={color}/> }} />
      <Tabs.Screen name="financeiro" options={{ title:'Financeiro', tabBarIcon:({color})=><Icon emoji="▣" color={color}/> }} />
      <Tabs.Screen name="relatorios" options={{ title:'Relatórios', tabBarIcon:({color})=><Icon emoji="▥" color={color}/> }} />
      <Tabs.Screen name="mais" options={{ title:'Mais', tabBarIcon:({color})=><Icon emoji="•••" color={color}/> }} />
    </Tabs>
  );
}
