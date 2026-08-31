import fs from 'node:fs';

const file='server.js';
let src=fs.readFileSync(file,'utf8');
const MARK='BR_DRE_MONTH_LOCK_ROUTE_V1';
if(src.includes(MARK))process.exit(0);

const anchor='// O HTML financeiro contém dados e nunca é servido sem sessão válida.';
if(!src.includes(anchor))throw new Error('Âncora do servidor não encontrada para trava da DRE.');

const code=`// ${MARK}\nconst BR_DRE_OWNER_EMAIL='esterzsilva@hotmail.com';\nconst BR_DRE_BIA_EMAIL='bpobrcondos@gmail.com';\nasync function brVerifyDreOwnerPassword(password){\n  const url=String(process.env.SUPABASE_URL||'').trim().replace(/\\/$/,'');\n  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();\n  if(!url||!key){const err=new Error('Autenticação não configurada.');err.status=503;throw err;}\n  const r=await fetch(\\\`${url}/auth/v1/token?grant_type=password\\\`,{\n    method:'POST',\n    headers:{apikey:key,'Content-Type':'application/json'},\n    body:JSON.stringify({email:BR_DRE_OWNER_EMAIL,password:String(password||'')})\n  });\n  if(!r.ok){const err=new Error('Senha da Ester inválida.');err.status=401;throw err;}\n  return true;\n}\napp.post('/api/auth/dre-owner-verify',requireAuth,route(async req=>{\n  const current=String(req.appUser?.email||'').trim().toLowerCase();\n  if(current!==BR_DRE_BIA_EMAIL){const err=new Error('Este desbloqueio é exclusivo para o acesso da Bia.');err.status=403;throw err;}\n  const password=String(req.body?.password||'');\n  if(!password){const err=new Error('Informe a senha da Ester.');err.status=400;throw err;}\n  await brVerifyDreOwnerPassword(password);\n  return {ok:true};\n}));\n\n`;

src=src.replace(anchor,code+anchor);
fs.writeFileSync(file,src,'utf8');
console.log('Trava mensal da DRE aplicada no servidor.');
