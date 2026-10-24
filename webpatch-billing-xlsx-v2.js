(function(){
  const XLSX_CDN='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const MONTHS={
    JANEIRO:1,FEVEREIRO:2,FEV:2,MARCO:3,MARÇO:3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,
    AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12
  };

  function norm(v){
    return String(v??'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }
  function n(v){
    if(typeof v==='number' && Number.isFinite(v))return v;
    let s=String(v??'').trim();
    if(!s)return 0;
    s=s.replace(/R\$/gi,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(','))s=s.replace(',','.');
    const x=Number(s);
    return Number.isFinite(x)?x:0;
  }
  function brl(v){
    return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function nextMonth(year,month){
    return month===12?{year:year+1,month:1}:{year,month:month+1};
  }
  function pad2(v){return String(v).padStart(2,'0');}
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-brcondos-xlsx="1"]');
      if(existing){
        existing.addEventListener('load',()=>resolve(window.XLSX),{once:true});
        existing.addEventListener('error',()=>reject(new Error('Não foi possível carregar o leitor de planilhas.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=XLSX_CDN;s.async=true;s.dataset.brcondosXlsx='1';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de planilhas não iniciou.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o leitor de planilhas.'));
      document.head.appendChild(s);
    });
  }
  function parseCompetence(title,sheetName){
    const text=norm(`${title||''} ${sheetName||''}`);
    let month=0;
    for(const [name,num] of Object.entries(MONTHS)){
      if(new RegExp(`(?:^| )${name}(?: |$)`).test(text)){month=num;break;}
    }
    const yearMatch=text.match(/\b(20\d{2})\b/);
    const year=yearMatch?Number(yearMatch[1]):0;
    return month&&year?{month,year,ym:`${year}-${pad2(month)}`} : null;
  }
  function headerIndex(headers,aliases){
    const hs=headers.map(norm);
    for(const alias of aliases){
      const target=norm(alias);
      const exact=hs.findIndex(x=>x===target);
      if(exact>=0)return exact;
    }
    for(const alias of aliases){
      const target=norm(alias);
      const partial=hs.findIndex(x=>x.includes(target)||target.includes(x));
      if(partial>=0)return partial;
    }
    return -1;
  }
  function findHeaderRow(matrix){
    for(let r=0;r<Math.min(matrix.length,12);r++){
      const row=(matrix[r]||[]).map(norm);
      if(row.includes('CLIENTE') && row.includes('TOTAL'))return r;
    }
    return -1;
  }
  function buildObservation(row,idx){
    const parts=[];
    const push=(label,col)=>{
      if(col<0)return;
      const value=n(row[col]);
      if(value>0)parts.push(`${label} - ${brl(value)}`);
    };
    push('Honorário Adm',idx.honorario);
    push('Modulo cobrança',idx.cobranca);
    push('Modulo manutenção',idx.manutencao);
    push('Assemb. Extra',idx.assembleia);
    if(idx.rpa>=0){
      const value=n(row[idx.rpa]);
      if(value>0){
        let line=`RPA - ${brl(value)}`;
        const details=idx.detalhes>=0?String(row[idx.detalhes]??'').trim():'';
        if(details)line+=` - ${details}`;
        parts.push(line);
      }
    }
    return parts.join('\n');
  }
  function sheetCandidates(workbook,XLSX){
    const out=[];
    workbook.SheetNames.forEach(name=>{
      const ws=workbook.Sheets[name];
      if(!ws)return;
      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
      if(!matrix.length)return;
      const headerRow=findHeaderRow(matrix);
      if(headerRow<0)return;
      const title=matrix[0]?.[0]||'';
      const comp=parseCompetence(title,name);
      if(!comp)return;
      out.push({name,matrix,headerRow,...comp});
    });
    return out.sort((a,b)=>b.ym.localeCompare(a.ym));
  }

  function chooseBillingRows(rows,competence){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(10,20,35,.66);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px';
      const panel=document.createElement('div');
      panel.style.cssText='background:white;color:#17212f;width:min(850px,98vw);max-height:90vh;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;padding:18px;box-shadow:0 18px 55px #0005';
      const h=document.createElement('h2');h.textContent='Selecionar faturamentos — '+competence;h.style.margin='0 0 6px';
      const hint=document.createElement('p');hint.textContent='Marque somente os condomínios que deseja importar para emissão. Nenhum boleto será enviado ao banco nesta etapa.';hint.style.margin='0 0 12px';
      const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;gap:10px;align-items:center;margin-bottom:10px';
      const all=document.createElement('input');all.type='checkbox';all.checked=true;all.id='billing-select-all';
      const label=document.createElement('label');label.htmlFor=all.id;label.textContent=' Selecionar todos';
      const count=document.createElement('span');count.style.marginLeft='auto';
      toolbar.append(all,label,count);
      const list=document.createElement('div');list.style.cssText='overflow:auto;border:1px solid #dce2e8;border-radius:8px;flex:1;min-height:120px';
      const selected=new Set(rows.map((_,i)=>i));
      const checks=[];
      const update=()=>{count.textContent=selected.size+' de '+rows.length+' selecionados';all.checked=selected.size===rows.length;all.indeterminate=selected.size>0&&selected.size<rows.length;};
      rows.forEach((r,i)=>{
        const line=document.createElement('label');line.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #edf0f3;cursor:pointer';
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.addEventListener('change',()=>{if(cb.checked)selected.add(i);else selected.delete(i);update();});
        const name=document.createElement('span');name.textContent=r.client;name.style.flex='1';
        const val=document.createElement('strong');val.textContent=brl(r.total);
        line.append(cb,name,val);list.append(line);checks.push(cb);
      });
      all.addEventListener('change',()=>{checks.forEach((cb,i)=>{cb.checked=all.checked;if(all.checked)selected.add(i);else selected.delete(i);});update();});
      const foot=document.createElement('div');foot.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:14px';
      const cancel=document.createElement('button');cancel.textContent='Cancelar';
      const ok=document.createElement('button');ok.textContent='Importar selecionados';ok.style.cssText='background:#155abb;color:white;border:0;padding:10px 16px;border-radius:7px';
      const finish=result=>{overlay.remove();resolve(result);};
      cancel.onclick=()=>finish(null);
      ok.onclick=()=>{if(!selected.size){alert('Selecione pelo menos um condomínio.');return;}finish(rows.filter((_,i)=>selected.has(i)));};
      foot.append(cancel,ok);panel.append(h,hint,toolbar,list,foot);overlay.append(panel);document.body.append(overlay);update();
    });
  }

  async function importMonthlyBillingXlsx(input){
    const file=input?.files?.[0];
    if(!file)return;
    try{
      const XLSX=await loadXlsx();
      const buffer=await file.arrayBuffer();
      const workbook=XLSX.read(buffer,{type:'array',cellDates:false});
      const candidates=sheetCandidates(workbook,XLSX);
      if(!candidates.length)throw new Error('Não encontrei nenhuma aba mensal com as colunas CLIENTE e TOTAL.');

      const selected=candidates[0];
      const headers=selected.matrix[selected.headerRow]||[];
      const idx={
        cliente:headerIndex(headers,['CLIENTE']),
        honorario:headerIndex(headers,['HNO ADM COND','HONO ADM COND','HONORARIO ADM','HONORÁRIO ADM']),
        fopag:headerIndex(headers,['FOPAG']),
        sped:headerIndex(headers,['SPED-EFD','SPED EFD']),
        esocial:headerIndex(headers,['E-SOCIAL','E SOCIAL','ESOCIAL']),
        livros:headerIndex(headers,['LIVROS']),
        dp:headerIndex(headers,['DP']),
        dbe:headerIndex(headers,['DBE']),
        cobranca:headerIndex(headers,['MODULO COBANCA','MODULO COBRANCA','MODULO COBANÇA','MOD. COB.','VALOR COBRADO DO CLIENTE']),
        manutencao:headerIndex(headers,['MODULO MANUT','MODULO MANUTENCAO','MODULO MANUTENÇÃO']),
        assembleia:headerIndex(headers,['ASSEM EXTRA','ASSEMB EXTRA','ASSEMBLEIA EXTRA']),
        rpa:headerIndex(headers,['RPA']),
        total:headerIndex(headers,['TOTAL']),
        detalhes:headerIndex(headers,['DETALHES']),
        venc:headerIndex(headers,['VENC'])
      };
      if(idx.cliente<0||idx.total<0)throw new Error('A planilha precisa ter as colunas CLIENTE e TOTAL.');

      const contTitleRow=selected.matrix.findIndex((row,ri)=>
        ri>selected.headerRow && norm(row?.[0]).includes('HONORARIOS CONTABEIS ASSOCIACOES')
      );
      const contHeaderRow=contTitleRow>=0?contTitleRow+1:-1;
      let contEndRow=-1;
      if(contHeaderRow>=0){
        for(let rr=contHeaderRow+1;rr<selected.matrix.length;rr++){
          const rw=selected.matrix[rr]||[];
          const clientTxt=String(rw[idx.cliente]??'').trim();
          const totalVal=n(rw[idx.total]);
          if(!clientTxt && totalVal>0){contEndRow=rr-1;break;}
        }
      }

      const parsed=[];
      for(let r=selected.headerRow+1;r<selected.matrix.length;r++){
        const row=selected.matrix[r]||[];
        const client=String(row[idx.cliente]??'').trim();
        const total=n(row[idx.total]);
        if(!client||total<=0)continue;
        let day=idx.venc>=0?Math.trunc(n(row[idx.venc])):0;
        if(day<1||day>31)day=0;
        const isCont=contHeaderRow>=0 && r>contHeaderRow && (contEndRow<0 || r<=contEndRow);
        const honorarioRaw=idx.honorario>=0?n(row[idx.honorario]):0;
        const fopag=idx.fopag>=0?n(row[idx.fopag]):0;
        const sped=idx.sped>=0?n(row[idx.sped]):0;
        const esocial=idx.esocial>=0?n(row[idx.esocial]):0;
        const livros=idx.livros>=0?n(row[idx.livros]):0;
        const dp=idx.dp>=0?n(row[idx.dp]):0;
        const obs=isCont
          ? (honorarioRaw>0?`Honorário Cont - ${brl(honorarioRaw)}`:'')
          : buildObservation(row,idx);
        parsed.push({rowNo:r+1,client,total,day,obs,section:isCont?'CONTABIL':'ADM',
          honorario:isCont?0:honorarioRaw,
          fopag:isCont?0:fopag,sped:isCont?0:sped,esocial:isCont?0:esocial,
          livros:isCont?0:livros,dp:isCont?0:dp,
          honorarioCont:isCont?honorarioRaw:0,
          dbe:idx.dbe>=0?n(row[idx.dbe]):0,
          cobranca:idx.cobranca>=0?n(row[idx.cobranca]):0,
          manutencao:idx.manutencao>=0?n(row[idx.manutencao]):0,
          assembleia:idx.assembleia>=0?n(row[idx.assembleia]):0,
          rpa:idx.rpa>=0?n(row[idx.rpa]):0,
          detalhesOriginais:idx.detalhes>=0?String(row[idx.detalhes]??'').trim():''
        });
      }
      if(!parsed.length)throw new Error(`A aba ${selected.name} não possui linhas com CLIENTE e TOTAL preenchidos.`);

      const chosen=await chooseBillingRows(parsed,selected.name+' ('+pad2(selected.month)+'/'+selected.year+')');
      if(!chosen)return;

      const dueMonth=nextMonth(selected.year,selected.month);
      const existing=new Set((boletos||[]).map(b=>b.sourceKey).filter(Boolean));
      let added=0,dups=0,noDue=0,admSeq=0,contSeq=0;
      const billingIdBase=Date.now()*1000;
      const historicoEmitidoNoBanco=selected.ym>='2026-01'&&selected.ym<='2026-07';

      chosen.forEach((r,i)=>{
        const due=r.day?`${dueMonth.year}-${pad2(dueMonth.month)}-${pad2(r.day)}`:'';
        if(!due)noDue++;
        const sectionCode=r.section==='CONTABIL'?'CONT':'ADM';
        const sectionSeq=r.section==='CONTABIL'?++contSeq:++admSeq;
        const sourceKey=`xlsx-${selected.ym}-${sectionCode}-${norm(r.client)}-${r.total.toFixed(2)}-${r.day||'SEM'}-${norm(r.obs)}-${r.rowNo}`;
        if(existing.has(sourceKey)){dups++;return;}
        const c=typeof findClientByLooseName==='function'?findClientByLooseName(r.client):null;
        boletos.push({
          id:billingIdBase+i,
          clientId:c?.id||0,
          client:r.client,
          docNumber:`FAT-${pad2(selected.month)}${selected.year}-${sectionCode}-${String(sectionSeq).padStart(3,'0')}`,
          due,
          value:Number(r.total),
          description:r.section==='CONTABIL'
            ?`Faturamento CONT - ${pad2(selected.month)}/${selected.year}`
            :`Faturamento ADM - ${pad2(selected.month)}/${selected.year}`,
          details:r.obs,
          bank:historicoEmitidoNoBanco?'Emitido diretamente no banco':'Integração pendente',
          status:!due?'pendente_vencimento':(historicoEmitidoNoBanco?'emitido_externo':'aguardando_integracao'),
          externalIssued:historicoEmitidoNoBanco&&!!due,
          receiptDate:'',flowId:null,sourceKey,competence:selected.ym,section:r.section,
          billingBreakdown:{
            honorarioAdm:r.honorario,
            fopag:r.fopag,spedEfd:r.sped,eSocial:r.esocial,livros:r.livros,dp:r.dp,
            honorarioCont:r.honorarioCont,
            dbe:r.dbe,
            moduloCobranca:r.cobranca,
            moduloManutencao:r.manutencao,
            assembleiaExtra:r.assembleia,
            rpa:r.rpa,
            detalhes:r.detalhesOriginais
          }
        });
        existing.add(sourceKey);added++;
      });

      saveData('boletos',boletos);
      renderAll();
      alert(`IMPORTAÇÃO CONCLUÍDA ✅\n\nCompetência: ${pad2(selected.month)}/${selected.year}\nBoletos criados: ${added}\nDuplicados ignorados: ${dups}\nSem vencimento: ${noDue}\n\nValor: coluna TOTAL.\nObservações: somente os campos que possuem valor.`);
    }catch(e){
      alert(`Não consegui importar a planilha:\n${e?.message||e}`);
    }finally{
      if(input)input.value='';
    }
  }
  window.importMonthlyBillingXlsx=importMonthlyBillingXlsx;

  function enhanceBoletos(){
    const view=document.getElementById('view-boletos');
    if(!view)return;
    const oldInput=document.getElementById('monthlyBillingPdf');
    if(oldInput){
      oldInput.accept='.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
      oldInput.setAttribute('onchange','importMonthlyBillingXlsx(this)');
    }
    const buttons=[...view.querySelectorAll('button')];
    const importBtn=buttons.find(b=>/Importar PDF mensal/i.test(b.textContent||''));
    if(importBtn){
      importBtn.textContent='⇧ Importar planilha mensal';
      importBtn.setAttribute('onclick',"document.getElementById('monthlyBillingPdf').click()");
    }
    const notice=view.querySelector('.notice');
    if(notice){
      notice.innerHTML='<b>Regra do faturamento:</b> importe a planilha mensal em Excel. O sistema usa <b>TOTAL</b> como valor do boleto. No quadro ADM, a NFS-e soma HNO ADM COND, FOPAG, SPED-EFD e E-SOCIAL; LIVROS e DP entram no recibo. A observação usa Honorário Adm, Módulo cobrança, Módulo manutenção, Assemb. Extra e RPA somente quando houver valor. No quadro <b>Honorários Contábeis - Associações</b>, a descrição fica <b>Faturamento CONT</b> e os detalhes mostram apenas <b>Honorário Cont</b>. O vencimento continua no mês seguinte à competência.';
    }
    const ths=[...view.querySelectorAll('thead th')];
    const detailsTh=ths.find(th=>/^Detalhes$/i.test((th.textContent||'').trim()));
    if(detailsTh)detailsTh.textContent='Observação do boleto';
  }

  const originalRender=window.renderBoletos;
  if(typeof originalRender==='function'){
    window.renderBoletos=function(){
      const result=originalRender.apply(this,arguments);
      try{enhanceBoletos();}catch(e){console.error('Ajuste importação planilha',e);}
      return result;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceBoletos,0),{once:true});
  else setTimeout(enhanceBoletos,0);
})();
