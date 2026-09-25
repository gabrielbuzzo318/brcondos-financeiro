# BRCondos Mobile

Aplicativo mobile do BRCondos Financeiro, separado do frontend web e conectado à mesma base compartilhada.

## Escopo inicial
- Login com a autenticação atual do Supabase
- Dashboard
- Contas a receber e a pagar
- Inadimplência
- Fluxo de caixa e DRE
- Documentos e condomínios
- Relatórios e perfil

**Fora do mobile:** emissão de boletos e NFS.

## Backend
Por padrão usa `https://comarc.app.br`. Para trocar:

```bash
EXPO_PUBLIC_API_URL=https://seu-dominio npm start
```

## Rodar
Requer Node 22.13+ por usar Expo SDK 57.

```bash
cd mobile
npm install
npm start
```
