// Fonte de verdade: lista oficial da GISS de 26/08/2026 enviada pelo usuário.
(function(){
  const VERSION='brcondos_giss_lista_oficial_20260826_v1';
  const DONE_KEY='brcondos_giss_hist_218_258_recuperado_v1';
  const FINAL_KEY='brcondos_giss_hist_218_258_finalizado_v2';
  const locked=new Set(['emitida_nfse','cancelada_nfse']);
  const onlyDigits=v=>String(v||'').replace(/\D/g,'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const money=(a,b)=>Math.abs(Number(a||0)-Number(b||0))<0.01;

  const AUTH=[
    {nf:'3640',rps:'218',doc:'27964630000132',name:'AKADIA',value:3589.75,status:'emitida_nfse',time:'2026-08-26T09:42:31'},
    {nf:'3641',rps:'219',doc:'26717974000184',name:'ASSOCIAÇÃO EURO PARK I',value:4052.00,status:'emitida_nfse',time:'2026-08-26T11:41:21'},
    {nf:'3642',rps:'230',doc:'63717459000120',name:'SETOR RESIDENCIAL 2 - TORRE RESIDENCIAL D',value:3325.00,status:'emitida_nfse',time:'2026-08-26T11:51:51'},
    {nf:'3643',rps:'221',doc:'46743203000179',name:'CONDOMINIO PARK PRIME RESIDENCE',value:1920.00,status:'emitida_nfse',time:'2026-08-26T11:55:21'},
    {nf:'3644',rps:'222',doc:'17173529000100',name:'CONDOMINIO TOTALITE',value:3830.00,status:'emitida_nfse',time:'2026-08-26T11:55:33'},
    {nf:'3645',rps:'223',doc:'08986504000134',name:'ASSOCIACAO ECO VILLAGE',value:3658.00,status:'emitida_nfse',time:'2026-08-26T11:55:36'},
    {nf:'3646',rps:'224',doc:'24057826000155',name:'EDIFICIO MANUEL FELIPE',value:1212.00,status:'emitida_nfse',time:'2026-08-26T11:55:38'},
    {nf:'3647',rps:'225',doc:'46806088000134',name:'ASSOCIACAO DOS MORADORES EPLENUM - AMO EPLENUM',value:8563.80,status:'emitida_nfse',time:'2026-08-26T11:55:40'},
    {nf:'3648',rps:'226',doc:'26717974000184',name:'ASSOCIACAO EUROPARK I',value:2352.00,status:'cancelada_nfse',time:'2026-08-26T11:55:42'},
    {nf:'3649',rps:'228',doc:'23818526000189',name:'ASSOCIACAO QUINTA DO GOLFE HORIZONTES',value:1659.60,status:'emitida_nfse',time:'2026-08-26T11:55:44'},
    {nf:'3650',rps:'229',doc:'23729329000193',name:'ASSOCIACAO QUINTA DO GOLFE JARDINS',value:4740.00,status:'emitida_nfse',time:'2026-08-26T11:55:46'},
    {nf:'3651',rps:'231',doc:'19888907000167',name:'ALTOS DO IBORUNA',value:3082.00,status:'emitida_nfse',time:'2026-08-26T11:55:48'},
    {nf:'3652',rps:'232',doc:'09292689000140',name:'EDIFICIO ALFREDO AUGUSTO',value:592.00,status:'emitida_nfse',time:'2026-08-26T11:55:50'},
    {nf:'3653',rps:'233',doc:'10323407000103',name:'CONDOMINIO BOSQUE VIVENDAS',value:4615.00,status:'emitida_nfse',time:'2026-08-26T11:55:52'},
    {nf:'3654',rps:'234',doc:'39226339000146',name:'CONDOMINIO GREEN HOME',value:3519.30,status:'emitida_nfse',time:'2026-08-26T11:55:54'},
    {nf:'3655',rps:'235',doc:'15633941000130',name:'TERRA NOVA GREEN LIFE',value:3543.00,status:'emitida_nfse',time:'2026-08-26T11:55:56'},
    {nf:'3656',rps:'236',doc:'53213203000122',name:'CONDOMINIO DO EDIFICIO GINEZ GOMES',value:1657.00,status:'emitida_nfse',time:'2026-08-26T11:55:58'},
    {nf:'3657',rps:'237',doc:'18537810000147',name:'CONDOMINIO GIARDINO - CASAS DE VENEZA',value:2301.80,status:'emitida_nfse',time:'2026-08-26T11:56:01'},
    {nf:'3658',rps:'238',doc:'49223103000100',name:'EDIFICIO HAUT RESIDENCE',value:1400.00,status:'emitida_nfse',time:'2026-08-26T11:56:03'},
    {nf:'3659',rps:'239',doc:'65608103000184',name:'HUBLOT HIGIENOPOLIS',value:1518.00,status:'emitida_nfse',time:'2026-08-26T11:56:05'},
    {nf:'3660',rps:'240',doc:'63125965000120',name:'HYPE',value:2331.00,status:'emitida_nfse',time:'2026-08-26T11:56:07'},
    {nf:'3661',rps:'241',doc:'46806062000196',name:'CONDOMINIO IPE DA MATA',value:1937.90,status:'emitida_nfse',time:'2026-08-26T11:56:09'},
    {nf:'3662',rps:'242',doc:'03503569000168',name:'EDIFICIO JOAO PEDRO DE LUCA',value:592.00,status:'emitida_nfse',time:'2026-08-26T11:56:11'},
    {nf:'3663',rps:'243',doc:'56357445000188',name:'CONDOMINIO EDIFICIO MARIA LUCIA',value:2074.80,status:'emitida_nfse',time:'2026-08-26T11:56:13'},
    {nf:'3664',rps:'244',doc:'61747482000132',name:'MYRA JK',value:2625.00,status:'emitida_nfse',time:'2026-08-26T11:56:15'},
    {nf:'3665',rps:'245',doc:'05895468000105',name:'EDIFICIO MONTE SANTO',value:785.00,status:'emitida_nfse',time:'2026-08-26T11:56:17'},
    {nf:'3666',rps:'246',doc:'05535681000106',name:'EDIFICIO MAJORELLE',value:832.00,status:'emitida_nfse',time:'2026-08-26T11:56:19'},
    {nf:'3667',rps:'247',doc:'71745285000138',name:'CONDOMINIO E EDIFICIO MONT BLANC',value:1022.00,status:'emitida_nfse',time:'2026-08-26T11:56:21'},
    {nf:'3668',rps:'248',doc:'46600362000114',name:'NOVA RESIDENCE QUINTA DAS PAINEIRAS',value:3867.50,status:'emitida_nfse',time:'2026-08-26T11:56:23'},
    {nf:'3669',rps:'249',doc:'56358211000155',name:'CONDOMINIO EDIFICIO PIONNER',value:700.00,status:'emitida_nfse',time:'2026-08-26T11:56:25'},
    {nf:'3670',rps:'250',doc:'12567401000298',name:'PAS CORPORATE INCORPORACAO IMOBILIARIA SPE LTDA',value:4924.00,status:'cancelada_nfse',time:'2026-08-26T11:56:27'},
    {nf:'3671',rps:'251',doc:'52265304000184',name:'CONDOMINIO EDIFICIO RIOMAGGIORE',value:1627.00,status:'emitida_nfse',time:'2026-08-26T11:56:31'},
    {nf:'3672',rps:'253',doc:'37381644000187',name:'CONDOMINIO RESERVA DOS GUYRAS',value:2362.50,status:'emitida_nfse',time:'2026-08-26T11:56:34'},
    {nf:'3673',rps:'254',doc:'57155439000100',name:'CONDOMINIO SENSE RESIDENCE',value:2493.00,status:'emitida_nfse',time:'2026-08-26T11:56:36'},
    {nf:'3674',rps:'255',doc:'58266872000186',name:'CONDOMINIO T:ME',value:2451.00,status:'emitida_nfse',time:'2026-08-26T11:56:38'},
    {nf:'3675',rps:'256',doc:'48136052000116',name:'EDIFICIO TOSCANA',value:1773.50,status:'emitida_nfse',time:'2026-08-26T11:56:41'},
    {nf:'3676',rps:'261',doc:'55088275000110',name:'CONDOMINIO TORRES CIDADE NORTE',value:4147.50,status:'emitida_nfse',time:'2026-08-26T11:56:43'},
    {nf:'3677',rps:'262',doc:'08218781000105',name:'ASSOCIACAO ECO VILLAGE I',value:3758.00,status:'emitida_nfse',time:'2026-08-26T11:56:45'},
    {nf:'3678',rps:'263',doc:'46806062000196',name:'CONDOMINIO IPE DA MATA',value:52.00,status:'cancelada_nfse',time:'2026-08-26T11:56:47'},
    {nf:'3679',rps:'258',doc:'25529263000113',name:'ASSOCIAÇÃO BOM JARDIM II',value:1818.00,status:'emitida_nfse',time:'2026-08-26T11:59:42'}
  ];

  function findClient(a){
    const byDoc=(clients||[]).find(c=>onlyDigits(c.doc)===a.doc);
    if(byDoc)return byDoc;
    return (clients||[]).find(c=>norm(c.name)===norm(a.name))||null;
  }
  function findBoleto(a,c){
    let list=(boletos||[]).filter(b=>b.section!=='CONTABIL'&&!/CONTABIL/i.test(String(b.description||''))&&String(b.competence||'')==='2026-08');
    if(c){const x=list.filter(b=>Number(b.clientId)===Number(c.id)||norm(b.client)===norm(c.name));if(x.length)list=x;}
    else {const x=list.filter(b=>norm(b.client)===norm(a.name));if(x.length)list=x;}
    const byValue=list.find(b=>money(b.value,a.value));
    return byValue||list[0]||null;
  }

  function apply(){
    if(!Array.isArray(nfse))nfse=[];
    const original=[...nfse];
    const usedPending=new Set();
    const authoritative=[];

    for(const a of AUTH){
      const c=findClient(a);
      const b=findBoleto(a,c);
      let pending=original.find(x=>!locked.has(x.status)&&!usedPending.has(x.id)&&(
        (c&&(Number(x.clientId)===Number(c.id)||norm(x.client)===norm(c.name)))||norm(x.client)===norm(a.name)
      )&&money(x.value,a.value));
      if(pending)usedPending.add(pending.id);
      const oldLocked=original.find(x=>locked.has(x.status)&&String(x.rpsNumber||x.gissRpsNumber||'')===a.rps);
      const base=oldLocked||pending||{};
      authoritative.push({
        ...base,
        id:base.id||Date.now()+Number(a.rps),
        sourceBoletoId:base.sourceBoletoId||b?.id||'',
        clientId:c?.id||b?.clientId||base.clientId||0,
        client:c?.name||a.name,
        competence:'2026-08',
        value:a.value,
        description:base.description||'Administração de Condomínios.',
        rpsNumber:a.rps,
        gissRpsNumber:a.rps,
        issueDate:'2026-08-26',
        serviceDate:base.serviceDate||'',
        status:a.status,
        nfseNumber:a.nf,
        verificationCode:base.verificationCode||'',
        gissInternalId:base.gissInternalId||'',
        gissProtocol:base.gissProtocol||'',
        lastError:'',
        gissResponse:{...(base.gissResponse||{}),fonte:'lista_oficial_giss_20260826',emissao:a.time,situacao:a.status==='cancelada_nfse'?'Cancelada':'Ativa'}
      });
    }

    let others=original.filter(x=>{
      const r=Number(x.rpsNumber||x.gissRpsNumber||0);
      if(locked.has(x.status)&&r>=218&&r<=263)return false;
      if(usedPending.has(x.id))return false;
      return true;
    });
    others=others.map(x=>{
      const r=Number(x.rpsNumber||x.gissRpsNumber||0);
      if(!locked.has(x.status)&&r>0&&r<=263)return {...x,rpsNumber:'',gissRpsNumber:'',lastError:''};
      return x;
    });

    nfse=[...others,...authoritative];
    localStorage.setItem('brcondos_giss_last_rps','263');
    localStorage.setItem(DONE_KEY,'ok');
    localStorage.setItem(FINAL_KEY,'ok');
    if(typeof brcondosRenumerarRpsPendentes==='function')brcondosRenumerarRpsPendentes();
    saveData('nfse',nfse);
    localStorage.setItem(VERSION,'ok');
    localStorage.setItem('brcondos_giss_lista_oficial_20260826_resumo',JSON.stringify({total:40,ativas:37,canceladas:3,ultimoRps:263,proximoRps:264,at:new Date().toISOString()}));
    if(typeof renderAll==='function')renderAll();
  }

  if(localStorage.getItem(VERSION)!=='ok')apply();

  // Impede a rotina antiga de reconsultar/reembaralhar o histórico já fechado.
  window.brcondosRecuperarHistoricoGiss=async function(){
    return {ok:true,fonte:'lista_oficial_giss_20260826',total:40,ativas:37,canceladas:3,ultimoRps:263,proximoRps:264};
  };

  setTimeout(()=>{
    if(localStorage.getItem(VERSION)==='ok'&&typeof openModal==='function'){
      const shown='brcondos_giss_lista_oficial_20260826_modal_v1';
      if(localStorage.getItem(shown)!=='ok'){
        localStorage.setItem(shown,'ok');
        openModal('Histórico GISS reconstruído',`
          <div class="cards grid" style="grid-template-columns:repeat(4,1fr)">
            <div class="card accent-green"><div class="kpi-label">REGISTROS GISS</div><div class="kpi-value">40</div></div>
            <div class="card accent-green"><div class="kpi-label">ATIVAS</div><div class="kpi-value">37</div></div>
            <div class="card"><div class="kpi-label">CANCELADAS</div><div class="kpi-value">3</div></div>
            <div class="card accent-slate"><div class="kpi-label">PRÓXIMO RPS</div><div class="kpi-value">264</div></div>
          </div>
          <div class="notice" style="margin-top:12px"><b>Fonte:</b> lista oficial da GISS de 26/08/2026.<br>Canceladas: RPS 226, 250 e 263. O histórico não será mais reconstruído por aproximação.</div>
          <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>
        `);
      }
    }
  },900);
})();