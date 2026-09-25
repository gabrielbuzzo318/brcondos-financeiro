import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { logout } from '@/src/lib/api';
import { colors } from '@/src/theme';

export default function Mais(){
  const items=['Condomínios','Documentos','Notificações','Meu perfil','Configurações','Ajuda e suporte'];
  async function exit(){await logout();router.replace('/login')}
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>Mais</Text><View style={s.card}>{items.map(x=><View key={x} style={s.row}><Text style={s.name}>{x}</Text><Text style={s.chev}>›</Text></View>)}</View><Pressable onPress={exit} style={s.logout}><Text style={s.logoutText}>Sair da conta</Text></Pressable></ScrollView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingTop:54},title:{fontSize:26,fontWeight:'900',color:colors.text,marginBottom:20},card:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'},row:{height:55,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:colors.border},name:{fontWeight:'700',color:colors.text},chev:{fontSize:24,color:colors.muted},logout:{height:52,borderRadius:13,borderWidth:1,borderColor:'#F3C8C8',backgroundColor:'#fff',alignItems:'center',justifyContent:'center',marginTop:22},logoutText:{color:colors.danger,fontWeight:'800'}});
