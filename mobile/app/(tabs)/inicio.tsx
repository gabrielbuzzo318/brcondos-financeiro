import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getCurrentUser, getSharedState, BrUser } from '@/src/lib/api';
import { dashboardKpis, money, parseSharedState } from '@/src/lib/finance';
import { colors } from '@/src/theme';

export default function Inicio() {
  const [user,setUser]=useState<BrUser|null>(null);
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    try{
      const [u,s]=await Promise.all([getCurrentUser(),getSharedState()]);
      setUser(u);
      const parsed=parseSharedState(s);
      setData({ parsed, kpis:dashboardKpis(parsed) });
    }finally{setLoading(false)}
  },[]);

  useFocusEffect(useCallback(()=>{load()},[load]));

  if(loading&&!data)return <View style={styles.center}><ActivityIndicator color={colors.primary}/></View>;
  const k=data?.kpis||{};
  const overdue=(data?.parsed?.payables||[]).filter((p:any)=>p.status!=='pago'&&p.due&&String(p.due)<new Date().toISOString().slice(0,10)).slice(0,5);

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}>
    <View style={styles.header}>
      <View><Text style={styles.hello}>Olá, {user?.full_name?.split(' ')[0]||'BRCondos'}!</Text><Text style={styles.sub}>Aqui está o resumo de hoje.</Text></View>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.full_name||'BR').split(' ').map(x=>x[0]).join('').slice(0,2)}</Text></View>
    </View>
    <View style={styles.grid}>
      <Kpi label="A RECEBER" value={money(k.receivable)} tone="green"/>
      <Kpi label="A PAGAR" value={money(k.payable)} tone="red"/>
      <Kpi label="RECEBIDO NO MÊS" value={money(k.receivedMonth)} tone="green"/>
      <Kpi label="INADIMPLÊNCIA" value={money(k.inadimplencia)} tone="red"/>
    </View>
    <Text style={styles.section}>Precisam de atenção</Text>
    <View style={styles.card}>
      {overdue.length===0?<Text style={styles.empty}>Nenhuma conta vencida 🎉</Text>:overdue.map((p:any)=><View key={String(p.id)} style={styles.row}>
        <View style={{flex:1}}><Text style={styles.rowTitle}>{p.supplier||p.description||'Conta a pagar'}</Text><Text style={styles.rowSub}>{p.description||''} • vence {p.due}</Text></View>
        <Text style={styles.bad}>{money(p.value)}</Text>
      </View>)}
    </View>
    <Text style={styles.section}>Visão do app</Text>
    <View style={styles.card}><Text style={styles.info}>No mobile vamos priorizar consulta e operação financeira: baixas, contas, inadimplência, fluxo, DRE, documentos e condomínios. Emissão de boletos e NFS fica somente no sistema web.</Text></View>
  </ScrollView>
}

function Kpi({label,value,tone}:{label:string;value:string;tone:'green'|'red'}){
  return <View style={[styles.kpi,{backgroundColor:tone==='green'?colors.successSoft:colors.dangerSoft}]}>
    <Text style={styles.kpiLabel}>{label}</Text><Text style={[styles.kpiValue,{color:tone==='green'?colors.success:colors.danger}]}>{value}</Text>
  </View>
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingTop:54,paddingBottom:30},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:20},hello:{fontSize:25,fontWeight:'900',color:colors.text},sub:{color:colors.muted,marginTop:3},
  avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'900'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},kpi:{width:'48.5%',borderRadius:16,padding:14,minHeight:92},kpiLabel:{fontSize:10,fontWeight:'800',color:colors.muted},kpiValue:{fontSize:19,fontWeight:'900',marginTop:10},
  section:{fontSize:17,fontWeight:'900',color:colors.text,marginTop:24,marginBottom:10},card:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:colors.border},rowTitle:{fontWeight:'800',color:colors.text},rowSub:{fontSize:11,color:colors.muted,marginTop:4},bad:{fontWeight:'900',color:colors.danger},
  empty:{padding:18,color:colors.muted},info:{padding:16,color:colors.muted,lineHeight:20}
});
