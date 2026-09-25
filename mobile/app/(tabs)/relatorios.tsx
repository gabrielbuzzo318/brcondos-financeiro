import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/src/theme';

export default function Relatorios(){
  const items=[
    ['Fluxo de Caixa','Entradas e saídas por período',''],
    ['DRE','Demonstrativo de Resultado',''],
    ['Inadimplência','Lista e evolução das cobranças','/inadimplencia'],
    ['Contas a Pagar','Por fornecedor e categoria',''],
    ['Contas a Receber','Por condomínio e período',''],
    ['Extrato do Condomínio','Histórico completo','']
  ];
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>Relatórios</Text><Text style={s.sub}>Os relatórios mais úteis da BRCondos no celular.</Text><View style={s.card}>{items.map(([a,b,path])=><Pressable key={a} disabled={!path} onPress={()=>path&&router.push(path as any)} style={s.row}><View style={s.icon}><Text>▥</Text></View><View style={{flex:1}}><Text style={s.name}>{a}</Text><Text style={s.desc}>{b}</Text></View><Text style={s.chev}>{path?'›':'·'}</Text></Pressable>)}</View></ScrollView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingTop:54},title:{fontSize:26,fontWeight:'900',color:colors.text},sub:{color:colors.muted,marginTop:4,marginBottom:22},card:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'},row:{flexDirection:'row',alignItems:'center',padding:15,borderBottomWidth:1,borderBottomColor:colors.border},icon:{width:38,height:38,borderRadius:11,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center',marginRight:12},name:{fontWeight:'800',color:colors.text},desc:{fontSize:11,color:colors.muted,marginTop:3},chev:{fontSize:26,color:colors.muted}});
