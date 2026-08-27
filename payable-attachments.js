const SUPABASE_URL=String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
const SUPABASE_KEY=String(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();

function ensureConfigured(){
  if(!SUPABASE_URL||!SUPABASE_KEY){
    const err=new Error('Supabase não configurado para anexos.');
    err.status=503;
    throw err;
  }
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
    ...(token?{Authorization:`Bearer ${token}`}:{ }),
    ...(options.headers||{})
  };
  return await fetch(`${SUPABASE_URL}${path}`,{...options,headers});
}

function parseDataUrl(dataUrl){
  const raw=String(dataUrl||'');
  const m=raw.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/);
  if(!m){const err=new Error('Arquivo inválido.');err.status=400;throw err;}
  const contentType=String(m[1]||'application/octet-stream');
  const base64=m[2].replace(/\s+/g,'');
  const bytes=Math.floor(base64.length*3/4)-(base64.endsWith('==')?2:base64.endsWith('=')?1:0);
  if(bytes>1800000){const err=new Error('O anexo deve ter no máximo 1,8 MB.');err.status=400;throw err;}
  return {contentType,base64,bytes};
}

export async function createPayableAttachment(req,body={}){
  const user=req?.appUser;
  if(user?.access_level!=='admin'){
    const err=new Error('Seu usuário não tem permissão para anexar arquivos.');
    err.status=403;
    throw err;
  }
  const fileName=String(body.fileName||'anexo').trim().slice(0,240)||'anexo';
  const dataUrl=String(body.dataUrl||'');
  const parsed=parseDataUrl(dataUrl);
  const token=String(req?.brAccessToken||'').trim();
  if(!token){const err=new Error('Sessão não disponível.');err.status=401;throw err;}

  const payload={
    file_name:fileName,
    content_type:parsed.contentType,
    data_url:dataUrl,
    uploaded_by:user.id
  };
  const res=await supabaseFetch('/rest/v1/payable_attachments',token,{
    method:'POST',
    headers:{'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify(payload)
  });
  const data=await readJson(res);
  if(!res.ok){const err=new Error(data?.message||'Não foi possível salvar o anexo.');err.status=res.status;throw err;}
  const row=Array.isArray(data)?data[0]:data;
  return {ok:true,id:row?.id,fileName:row?.file_name||fileName,contentType:row?.content_type||parsed.contentType};
}

export async function getPayableAttachment(req,id){
  const token=String(req?.brAccessToken||'').trim();
  if(!token){const err=new Error('Sessão não disponível.');err.status=401;throw err;}
  const clean=String(id||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(clean)){const err=new Error('Anexo inválido.');err.status=400;throw err;}
  const res=await supabaseFetch(`/rest/v1/payable_attachments?select=id,file_name,content_type,data_url&id=eq.${encodeURIComponent(clean)}&limit=1`,token,{
    method:'GET',headers:{Accept:'application/json'}
  });
  const data=await readJson(res);
  if(!res.ok){const err=new Error(data?.message||'Não foi possível carregar o anexo.');err.status=res.status;throw err;}
  const row=Array.isArray(data)?data[0]:null;
  if(!row){const err=new Error('Anexo não encontrado.');err.status=404;throw err;}
  const parsed=parseDataUrl(row.data_url);
  return {
    fileName:String(row.file_name||'anexo'),
    contentType:String(row.content_type||parsed.contentType||'application/octet-stream'),
    buffer:Buffer.from(parsed.base64,'base64')
  };
}
