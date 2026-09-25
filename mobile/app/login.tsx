import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { login } from '@/src/lib/api';
import { colors } from '@/src/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password || loading) return;
    setLoading(true); setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)/inicio');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={styles.logoText}>BR</Text></View>
        <Text style={styles.title}>BRCondos</Text>
        <Text style={styles.subtitle}>Gestão condominial na palma da sua mão</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.welcome}>Bem-vindo de volta!</Text>
        <Text style={styles.help}>Acesse sua conta para continuar.</Text>
        <Text style={styles.label}>E-mail</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="seu@email.com" />
        <Text style={styles.label}>Senha</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="••••••••" onSubmitEditing={submit} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, loading && { opacity: .7 }]} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.primaryDark,justifyContent:'center',padding:22},
  brand:{alignItems:'center',marginBottom:28},
  logo:{width:64,height:64,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',marginBottom:12},
  logoText:{color:colors.primary,fontSize:24,fontWeight:'900'},
  title:{color:'#fff',fontSize:32,fontWeight:'900'},
  subtitle:{color:'#CFE5DE',fontSize:13,marginTop:4},
  card:{backgroundColor:'#fff',borderRadius:24,padding:22},
  welcome:{fontSize:22,fontWeight:'800',color:colors.text},
  help:{color:colors.muted,marginTop:4,marginBottom:20},
  label:{fontSize:12,fontWeight:'700',color:colors.text,marginBottom:7,marginTop:10},
  input:{height:50,borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:14,backgroundColor:'#FBFCFC'},
  error:{color:colors.danger,marginTop:12,fontSize:12},
  button:{height:52,borderRadius:13,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',marginTop:22},
  buttonText:{color:'#fff',fontWeight:'800',fontSize:16}
});
