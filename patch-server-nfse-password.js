import fs from 'node:fs';

const file='server.js';
let src=fs.readFileSync(file,'utf8');

const marker='// Reautenticação de senha para emissão de NFS-e.';
if(!src.includes(marker)){
  const helper=`\n${marker}\nconst nfseReauthTokens=new Map();\nconst NFSE_REAUTH_TTL_MS=15*60*1000;\n\nfunction readCookieValue(req,name){\n  const raw=String(req.headers.cookie||'');\n  for(const part of raw.split(';')){\n    const idx=part.indexOf('=');\n    if(idx<0)continue;\n    const key=part.slice(0,idx).trim();\n    if(key!==name)continue;\n    const value=part.slice(idx+1).trim();\n    try{return decodeURIComponent(value)}catch{return value}\n  }\n  return '';\n}\n\nfunction cleanupNfseReauthTokens(){\n  const now=Date.now();\n  for(const [token,entry] of nfseReauthTokens){\n    if(!entry||entry.expiresAt<=now)nfseReauthTokens.delete(token);\n  }\n}\n\nasync function verifyNfsePassword(req,res){\n  if(!String(process.env.APP_PUBLIC_URL||'').trim())return {ok:true,setupMode:true};\n  const password=String(req.body?.password||'');\n  if(!password){const err=new Error('Digite sua senha.');err.status=400;throw err}\n  const email=String(req.appUser?.email||'').trim().toLowerCase();\n  if(!email){const err=new Error('Sessão inválida. Entre novamente.');err.status=401;throw err}\n\n  const supabaseUrl=String(process.env.SUPABASE_URL||'').trim().replace(/\\/$/,'');\n  const supabaseKey=String(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();\n  if(!supabaseUrl||!supabaseKey){const err=new Error('Autenticação não configurada.');err.status=503;throw err}\n\n  const tokenRes=await fetch(\`${'${supabaseUrl}'}/auth/v1/token?grant_type=password\`,{\n    method:'POST',\n    headers:{apikey:supabaseKey,'Content-Type':'application/json'},\n    body:JSON.stringify({email,password})\n  });\n  const data=await tokenRes.json().catch(()=>({}));\n  if(!tokenRes.ok||!data?.access_token){const err=new Error('Senha inválida.');err.status=401;throw err}\n\n  cleanupNfseReauthTokens();\n  const reauthToken=crypto.randomBytes(32).toString('base64url');\n  nfseReauthTokens.set(reauthToken,{userId:String(req.appUser?.id||''),expiresAt:Date.now()+NFSE_REAUTH_TTL_MS});\n  res.cookie('br_nfse_reauth',reauthToken,{\n    httpOnly:true,secure:true,sameSite:'lax',path:'/api/nfse',maxAge:NFSE_REAUTH_TTL_MS\n  });\n  return {ok:true};\n}\n\nfunction requireRecentNfsePassword(req,res,next){\n  if(!String(process.env.APP_PUBLIC_URL||'').trim())return next();\n  cleanupNfseReauthTokens();\n  const token=readCookieValue(req,'br_nfse_reauth');\n  const entry=token?nfseReauthTokens.get(token):null;\n  if(!entry||entry.expiresAt<=Date.now()||String(entry.userId)!==String(req.appUser?.id||'')){\n    return res.status(401).json({error:'Confirme sua senha antes de emitir a NFS-e.',code:'NFSE_REAUTH_REQUIRED'});\n  }\n  next();\n}\n`;
  src=src.replace("app.get('/health', (_req, res) => res.json({ ok: true, service: 'brcondos-financeiro' }));",helper+"\napp.get('/health', (_req, res) => res.json({ ok: true, service: 'brcondos-financeiro' }));");
}

const authAnchor="app.post('/api/auth/first-access-complete', requireAuth, route((req, res) => markFirstAccessDone(req, res)));";
if(!src.includes("/api/auth/verify-nfse-password")){
  src=src.replace(authAnchor,authAnchor+"\napp.post('/api/auth/verify-nfse-password', requireAuth, requireWriteAccess, route((req, res) => verifyNfsePassword(req, res))); ");
}

src=src.replace(
  "app.post('/api/nfse/emitir', requireWriteAccess, route(req => emitirNfseGiss(req.body)));",
  "app.post('/api/nfse/emitir', requireWriteAccess, requireRecentNfsePassword, route(req => emitirNfseGiss(req.body)));"
);

fs.writeFileSync(file,src,'utf8');
console.log('Proteção por senha da emissão NFS-e aplicada.');