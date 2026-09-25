import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { getSharedState } from '@/src/lib/api';
import { money, parseSharedState } from '@/src/lib/finance';
import { colors } from '@/src/theme';

const today=()=>new Date().toISOString().slice(0,10);
const norm=(v:any)=>String(v||'').toLowerCase();

export default function Inadimplencia(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const d=parseSharedState(await getSharedState());
      const boletos=d.boletos
        .filter((b:any)=>{
          const st=norm(b.status);
          return !['recebido','liquidado','pago','baixado'].includes(st) && b.due && String(b.due)<today();
        })
        .map((b:any)=>({...b,source:'Boleto',name:b.client||b.payer||'Cliente'}));
      const manual=d.manualInadimplencias
        .filter((x:any)=>!['liquidado','pago','baixado','resolvida'].includes(norm(x.status)))
        .map((x:any)=>({...x,source:'Manual',name:x.client||x.condominio||x.description||'Cobrança'}));
      setRows([...boletos,...manual].sort((a,b)=>String(a.due||a.date||'').localeCompare(String(b.due||b.date||''))));
    }finally{setLoading(false)}
  },[]);

  useFocusEffect(useCallback(()=>{load()},[load]));
  const total=rows.reduce((s,x)=>s+Number(x.value||0),0);

  return <>
    <Stack.Screen options={{headerShown:true,title:'Inadimplências',headerTintColor:colors.primary}}/>
    <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}>
      <View style={s.hero}><Text style={s.heroLabel}>TOTAL EM INADIMPLÊNCIA</Text><Text style={s.heroValue}>{money(total)}</Text><Text style={s.heroSub}>{rows.length} cobrança{rows.length===1?'':'s'} pendente{rows.length===1?'':'s'}</Text></View>
      <View style={s.card}>
        {loading&&!rows.length?<ActivityIndicator style={{padding:24}} color={colors.primary}/>:rows.length===0?<Text style={s.empty}>Nenhuma inadimplência ativa 🎉</Text>:rows.map((x,i)=><View key={String(x.id||i)} style={s.row}>
          <View style={{flex:1}}>
            <View style={s.topline}><Text style={s.name}>{x.name}</Text><Text style={s.badge}>{x.source}</Text></View>
            <Text style={s.desc}>{x.description||x.docNumber||'Cobrança em atraso'}</Text>
            <Text style={s.due}>{x.due?`Vencimento: ${x.due}`:x.date?`Data: ${x.date}`:''}</Text>
          </View>
          <Text style={s.value}>{money(x.value)}</Text>
        </View>)}
      </View>
    </ScrollView>
  </>
}

const s=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingBottom:32},
  hero:{backgroundColor:colors.dangerSoft,borderRadius:18,padding:18,marginBottom:16,borderWidth:1,borderColor:'#F3CCCC'},
  heroLabel:{fontSize:10,fontWeight:'900',color:colors.muted},heroValue:{fontSize:29,fontWeight:'900',color:colors.danger,marginTop:7},heroSub:{fontSize:12,color:colors.muted,marginTop:5},
  card:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:colors.border,gap:10},
  topline:{flexDirection:'row',alignItems:'center',gap:7},name:{fontWeight:'800',color:colors.text,flexShrink:1},badge:{fontSize:9,fontWeight:'800',color:colors.danger,backgroundColor:colors.dangerSoft,paddingHorizontal:7,paddingVertical:3,borderRadius:8},
  desc:{fontSize:11,color:colors.muted,marginTop:5},due:{fontSize:10,color:colors.muted,marginTop:3},value:{fontWeight:'900',color:colors.danger},empty:{padding:20,color:colors.muted}
});
