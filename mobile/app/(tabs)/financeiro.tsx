import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getSharedState } from '@/src/lib/api';
import { money, parseSharedState } from '@/src/lib/finance';
import { colors } from '@/src/theme';

export default function Financeiro(){
  const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{try{setData(parseSharedState(await getSharedState()))}finally{setLoading(false)}},[]);
  useFocusEffect(useCallback(()=>{load()},[load]));
  if(!data&&loading)return <View style={s.center}><ActivityIndicator color={colors.primary}/></View>;
  const pay=(data?.payables||[]).filter((x:any)=>x.status!=='pago').slice().sort((a:any,b:any)=>String(a.due||'').localeCompare(String(b.due||''))).slice(0,20);
  const rec=(data?.boletos||[]).filter((x:any)=>!['recebido','liquidado','pago'].includes(String(x.status||'').toLowerCase())).slice(0,20);
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}>
    <Text style={s.title}>Financeiro</Text><Text style={s.sub}>Contas a pagar e receber em um só lugar.</Text>
    <Section title="Contas a receber" items={rec} kind="receber"/>
    <Section title="Contas a pagar" items={pay} kind="pagar"/>
  </ScrollView>
}
function Section({title,items,kind}:{title:string;items:any[];kind:'receber'|'pagar'}){
  return <View style={{marginTop:24}}><Text style={s.section}>{title}</Text><View style={s.card}>
    {items.length===0?<Text style={s.empty}>Nenhum lançamento em aberto.</Text>:items.map((x:any,i:number)=><View key={String(x.id||i)} style={s.row}>
      <View style={{flex:1}}><Text style={s.rowTitle}>{kind==='receber'?(x.client||x.payer||x.description||'Cliente'):(x.supplier||x.description||'Fornecedor')}</Text>
      <Text style={s.rowSub}>{x.description||x.docNumber||''}{x.due?` • ${x.due}`:''}</Text></View>
      <View style={{alignItems:'flex-end'}}><Text style={[s.value,{color:kind==='receber'?colors.success:colors.danger}]}>{money(x.value)}</Text><Text style={s.status}>{x.status||'em aberto'}</Text></View>
    </View>)}
  </View></View>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingTop:54,paddingBottom:30},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},title:{fontSize:26,fontWeight:'900',color:colors.text},sub:{color:colors.muted,marginTop:4},section:{fontSize:16,fontWeight:'900',color:colors.text,marginBottom:10},card:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'},row:{flexDirection:'row',padding:14,borderBottomWidth:1,borderBottomColor:colors.border,alignItems:'center'},rowTitle:{fontWeight:'800',color:colors.text},rowSub:{fontSize:11,color:colors.muted,marginTop:4},value:{fontWeight:'900'},status:{fontSize:10,color:colors.muted,marginTop:4,textTransform:'capitalize'},empty:{padding:18,color:colors.muted}});
