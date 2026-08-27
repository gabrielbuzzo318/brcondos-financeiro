const SUPABASE_URL=String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
const SUPABASE_KEY=String(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();

const SPECIAL_WRITERS=new Set([
  'antonio@zacchi.com.br',
  'marco.dosualdo@brcondos.com'
]);

function ensureConfigured(){
  if(!SUPABASE_URL||!SUPABASE_KEY){
    const err=new Error('Supabase não configurado para as anotações da DRE.');
    err.status=503;
    throw err;
  }
}

function validatePeriod(v){
  const period=String(v||'').trim();
  if(!/^\d{4}-\d{2}$/.test(period)){
    const err=new Error('Período da DRE inválido.');
    err.status=400;
    throw err;
  }
  return period;
}

function canWrite(user){
  if(!user)return false;
  if(user.access_level==='admin')return true;
  return SPECIAL_WRITERS.has(String(user.email||'').toLowerCase());
}

async function readJson(res){
  const text=await res.text();
  if(!text)return {};
  try{return JSON.parse(text);}catch{return {raw:text};}
}

async function supabaseFetch(path,token,options={}){
  ensureConfigured();
  const headers={
    apikey:SUPABASE_KEY,
    'Content-Type':'application/json',
    ...(token?{Authorization:`Bearer ${token}`}:{ }),
    ...(options.headers||{})
  };
  return await fetch(`${SUPABASE_URL}${path}`,{...options,headers});
}

export async function listDreNotes(req,periodRaw){
  const period=validatePeriod(periodRaw);
  const token=String(req?.brAccessToken||'').trim();
  if(!token){const err=new Error('Sessão não disponível.');err.status=401;throw err;}
  const path=`/rest/v1/dre_notes?select=id,period,note,author_name,author_email,created_at&period=eq.${encodeURIComponent(period)}&order=created_at.desc`;
  const res=await supabaseFetch(path,token,{method:'GET',headers:{Accept:'application/json'}});
  const data=await readJson(res);
  if(!res.ok){const err=new Error(data?.message||'Não foi possível carregar as anotações da DRE.');err.status=res.status;throw err;}
  return {ok:true,period,notes:Array.isArray(data)?data:[],canWrite:canWrite(req.appUser)};
}

export async function createDreNote(req,body={}){
  const user=req?.appUser;
  if(!canWrite(user)){
    const err=new Error('Seu usuário não tem permissão para escrever nas anotações da DRE.');
    err.status=403;
    throw err;
  }
  const period=validatePeriod(body.period);
  const note=String(body.note||'').trim();
  if(!note){const err=new Error('Digite uma anotação.');err.status=400;throw err;}
  if(note.length>3000){const err=new Error('A anotação deve ter no máximo 3.000 caracteres.');err.status=400;throw err;}
  const token=String(req?.brAccessToken||'').trim();
  if(!token){const err=new Error('Sessão não disponível.');err.status=401;throw err;}

  const payload={
    period,
    note,
    author_id:user.id,
    author_name:String(user.full_name||user.email||'Usuário'),
    author_email:String(user.email||'').toLowerCase()
  };
  const res=await supabaseFetch('/rest/v1/dre_notes',token,{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify(payload)
  });
  const data=await readJson(res);
  if(!res.ok){const err=new Error(data?.message||'Não foi possível salvar a anotação da DRE.');err.status=res.status;throw err;}
  const row=Array.isArray(data)?data[0]:data;
  return {ok:true,note:row};
}
