// Status visual, situação Sicredi e integração automática com o Fluxo de Caixa.
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

  function parseDateValue(value){
    if(typeof value!=='string'||!value.trim())return '';
    const iso=value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br=value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if(br)return `${br[3]}-${br[2]}-${br[1]}`;
    return '';
  }

  function findDate(data){
    const keys=[
      'dataLiquidacao','dataPagamento','dataBaixa','dataRecebimento','dataCredito',
      'dataMovimento','dataOcorrencia','dataEfetivacao'
    ];
    const seen=new Set();
    function walk(obj){
      if(!obj||typeof obj!=='object'||seen.has(obj))return '';
      seen.add(obj);
      for(const key of keys){
        const parsed=parseDateValue(obj[key]);
        if(parsed)return parsed;
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

  function findSettlementKind(data,statusText){
    const status=normalize(statusText);
    if(/PIX|QR\s*CODE|QRCODE/.test(status))return 'pix';
    if(/COBRANCA\s*SIMPLES|CODIGO\s*DE\s*BARRAS|BOLETO/.test(status))return 'boleto';

    const keys=[
      'tipoLiquidacao','tipoPagamento','formaPagamento','meioPagamento','modalidadePagamento',
      'tipoRecebimento','canalLiquidacao','origemLiquidacao','descricaoLiquidacao'
    ];
    const seen=new Set();

    function walk(obj){
      if(!obj||typeof obj!=='object'||seen.has(obj))return '';
      seen.add(obj);
      for(const key of keys){
        const value=normalize(obj[key]);
        if(!value)continue;
        if(/PIX|QR\s*CODE|QRCODE/.test(value))return 'pix';
        if(/COBRANCA\s*SIMPLES|CODIGO\s*DE\s*BARRAS|BOLETO/.test(value))return 'boleto';
      }
      for(const value of Object.values(obj)){
        const found=walk(value);
        if(found)return found;
      }
      return '';
    }

    // Na ausência de identificação explícita de PIX, tratamos como cobrança simples (D+1).
    return walk(data)||'boleto';
  }

  function addDaysIso(date,days){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return date||'';
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function nextFlowId(){
    let id=Date.now()+11;
    while((transactions||[]).some(t=>Number(t.id)===Number(id)))id++;
    return id;
  }

  function syncLiquidatedToFlow(boleto,data,statusText,{allowFallbackToday=true}={}){
    if(!boleto||!isLiquidated(statusText))return false;

    const liquidationDate=findDate(data)||boleto.receiptDate||boleto.sicrediLiquidationDate||(allowFallbackToday?today():'');
    if(!liquidationDate)return false;

    const kind=findSettlementKind(data,statusText||boleto.sicrediStatus||'');
    const flowDate=kind==='pix'?liquidationDate:addDaysIso(liquidationDate,1);

    boleto.status='recebido';
    boleto.receiptDate=liquidationDate;
    boleto.sicrediLiquidationDate=liquidationDate;
    boleto.sicrediSettlementType=kind;
    boleto.cashFlowDate=flowDate;

    let tx=null;
    if(boleto.flowId){
      tx=(transactions||[]).find(t=>Number(t.id)===Number(boleto.flowId))||null;
    }
    if(!tx){
      tx=(transactions||[]).find(t=>
        String(t.sourceBoletoId||t.boletoId||'')===String(boleto.id)
      )||null;
    }

    if(tx){
      tx.date=flowDate;
      tx.type='entrada';
      tx.status='pago';
      tx.sourceBoletoId=boleto.id;
      tx.sicrediSettlementType=kind;
      boleto.flowId=tx.id;
    }else{
      const flowId=nextFlowId();
      transactions.push({
        id:flowId,
        date:flowDate,
        type:'entrada',
        description:`Recebimento de boleto${boleto.docNumber?` ${boleto.docNumber}`:''}`,
        category:'Recebimento de boletos',
        party:boleto.client||'',
        value:Number(boleto.value||0),
        status:'pago',
        sourceBoletoId:boleto.id,
        sicrediSettlementType:kind
      });
      boleto.flowId=flowId;
    }

    if(typeof saveData==='function'){
      saveData('transactions',transactions);
      saveData('boletos',boletos);
    }
    return true;
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
              syncLiquidatedToFlow(boleto,data,sicrediStatus);
            }else if(typeof saveData==='function'){
              saveData('boletos',boletos);
            }
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

  // Completa o fluxo de boletos já consultados antes deste ajuste, sem inventar data.
  let backfilled=false;
  (boletos||[]).forEach(b=>{
    if(isLiquidated(b?.sicrediStatus||'')&&(b.receiptDate||b.sicrediLiquidationDate)){
      if(syncLiquidatedToFlow(b,null,b.sicrediStatus,{allowFallbackToday:false}))backfilled=true;
    }
  });
  if(backfilled&&typeof renderAll==='function')renderAll();
  else if(typeof renderBoletos==='function')renderBoletos();
})();
