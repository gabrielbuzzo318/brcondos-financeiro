// Status visual e sincronização de situação dos boletos Sicredi.
(function(){
  const originalFetch=window.fetch.bind(window);

  function normalize(v){
    return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  }

  function findStatusText(data){
    const priorityKeys=['situacao','status','situacaoTitulo','statusTitulo','descricaoSituacao','situacaoBoleto','statusBoleto'];
    const seen=new Set();

    function walk(obj){
      if(obj==null)return '';
      if(typeof obj==='string'){
        const t=normalize(obj);
        if(/LIQUIDAD|PAG[OA]|BAIXAD|VENCID|ABERT|REGISTRAD|ATIV/.test(t))return obj;
        return '';
      }
      if(typeof obj!=='object'||seen.has(obj))return '';
      seen.add(obj);

      for(const key of priorityKeys){
        if(Object.prototype.hasOwnProperty.call(obj,key)){
          const value=obj[key];
          if(typeof value==='string'&&value.trim())return value;
        }
      }
      for(const value of Object.values(obj)){
        const found=walk(value);
        if(found)return found;
      }
      return '';
    }
    return walk(data);
  }

  function findDate(data){
    const keys=['dataLiquidacao','dataPagamento','dataBaixa','dataCredito','dataRecebimento'];
    const seen=new Set();
    function walk(obj){
      if(!obj||typeof obj!=='object'||seen.has(obj))return '';
      seen.add(obj);
      for(const key of keys){
        const value=obj[key];
        if(typeof value==='string'&&value.trim()){
          const m=value.match(/(\d{4})-(\d{2})-(\d{2})/);
          if(m)return `${m[1]}-${m[2]}-${m[3]}`;
          const br=value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if(br)return `${br[3]}-${br[2]}-${br[1]}`;
        }
      }
      for(const value of Object.values(obj)){
        const found=walk(value);
        if(found)return found;
      }
      return '';
    }
    return walk(data);
  }

  function isLiquidated(v){
    const s=normalize(v);
    return /LIQUIDAD|PAGO|PAGA|BAIXAD/.test(s);
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const match=url.match(/\/api\/boletos\/(\d{9})(?:\?|$)/);
    const response=await originalFetch(input,init);

    if(method==='GET'&&match&&response.ok){
      try{
        const data=await response.clone().json();
        const nossoNumero=match[1];
        const boleto=(boletos||[]).find(b=>String(b.sicrediNossoNumero||'').replace(/\D/g,'')===nossoNumero);
        if(boleto){
          const sicrediStatus=findStatusText(data);
          if(sicrediStatus){
            boleto.sicrediStatus=sicrediStatus;
            boleto.sicrediStatusUpdatedAt=new Date().toISOString();
            if(isLiquidated(sicrediStatus)){
              boleto.status='recebido';
              boleto.receiptDate=boleto.receiptDate||findDate(data)||'';
            }
            if(typeof saveData==='function')saveData('boletos',boletos);
          }
        }
      }catch(_){ }
    }
    return response;
  };

  function badge(text,color){return `<span class="badge ${color}">${text}</span>`;}
  function boletoVisualStatus(b){
    const real=normalize(b?.sicrediStatus||'');
    if(isLiquidated(real)||b?.status==='liquidado')return {key:'liquidado',html:badge('Liquidado','green')};
    const closed=b?.status==='recebido';
    if(!closed&&b?.due&&String(b.due)<today())return {key:'vencido',html:badge('Vencido','red')};
    return null;
  }

  const originalRenderBoletos=renderBoletos;
  renderBoletos=function(){
    originalRenderBoletos();

    document.querySelectorAll('#view-boletos tbody tr[data-id]').forEach(tr=>{
      const b=(boletos||[]).find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!b)return;
      const visual=boletoVisualStatus(b);
      if(!visual)return;
      const statusCell=tr.querySelector('td:nth-child(6)');
      if(statusCell)statusCell.innerHTML=visual.html;
      tr.dataset.status=visual.key;
    });

    const statusSelect=document.getElementById('boleto_status');
    if(statusSelect){
      if(![...statusSelect.options].some(o=>o.value==='liquidado'))statusSelect.add(new Option('Liquidado','liquidado'));
      if(![...statusSelect.options].some(o=>o.value==='vencido'))statusSelect.add(new Option('Vencido','vencido'));
    }
  };

  if(typeof renderBoletos==='function')renderBoletos();
})();
