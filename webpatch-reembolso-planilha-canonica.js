(function(){
  const CANONICAL=[
    {id:9400001,sourceKey:'planilha-reembolso-01',displayOrder:1,date:'2026-05-11',type:'saida',description:'Salários',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:3695.37},
    {id:9400002,sourceKey:'planilha-reembolso-02',displayOrder:2,date:'2026-06-03',type:'saida',description:'Salários',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:2405.37},
    {id:9400003,sourceKey:'planilha-reembolso-03',displayOrder:3,date:'2026-08-05',type:'saida',description:'Salários',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:2405.37},
    {id:9400004,sourceKey:'planilha-reembolso-04',displayOrder:4,date:'2026-05-20',type:'saida',description:'Salários',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:1200.00},
    {id:9400005,sourceKey:'planilha-reembolso-05',displayOrder:5,date:'2026-06-17',type:'saida',description:'Salários',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:1200.00},
    {id:9400006,sourceKey:'planilha-reembolso-06',displayOrder:6,date:'2026-07-01',type:'saida',description:'Adiantamento de Salario.',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:2405.37},
    {id:9400007,sourceKey:'planilha-reembolso-07',displayOrder:7,date:'2026-07-15',type:'saida',description:'Adiantamento de Salario.',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:1200.00},
    {id:9400008,sourceKey:'planilha-reembolso-08',displayOrder:8,date:'2026-08-20',type:'saida',description:'Rescisão',status:'em_analise',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'EDSON LUIS DE SOUZA',value:2333.33},
    {id:9400009,sourceKey:'planilha-reembolso-09',displayOrder:9,date:'2026-07-01',type:'saida',description:'Registro de Ata',status:'em_analise',receivedDate:'',reimbursedBy:'Plaza Corporate',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:457.23},
    {id:9400010,sourceKey:'planilha-reembolso-10',displayOrder:10,date:'2026-07-20',type:'saida',description:'Rescisão',status:'em_analise',receivedDate:'',reimbursedBy:'Plaza Corporate',paidBy:'JULICE PADILHA SOARES',value:340.51},
    {id:9400011,sourceKey:'planilha-reembolso-11',displayOrder:11,date:'2026-08-31',type:'saida',description:'Compra de Celular',status:'em_analise',receivedDate:'',reimbursedBy:'Plaza Corporate',paidBy:'HBT STORE LTDA',value:1099.99},
    {id:9400012,sourceKey:'planilha-reembolso-12',displayOrder:12,date:'2026-06-17',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Hype',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:532.89},
    {id:9400013,sourceKey:'planilha-reembolso-13',displayOrder:13,date:'2026-06-17',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Murano',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:480.65},
    {id:9400014,sourceKey:'planilha-reembolso-14',displayOrder:14,date:'2026-06-10',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Europark II',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:471.94},
    {id:9400015,sourceKey:'planilha-reembolso-15',displayOrder:15,date:'2026-06-15',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Murano',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:266.26},
    {id:9400016,sourceKey:'planilha-reembolso-16',displayOrder:16,date:'2026-06-17',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Persona',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:152.76},
    {id:9400017,sourceKey:'planilha-reembolso-17',displayOrder:17,date:'2026-06-10',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Toscana',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:141.95},
    {id:9400018,sourceKey:'planilha-reembolso-18',displayOrder:18,date:'2026-06-17',type:'saida',description:'Registro de Ata',status:'solicitado',receivedDate:'',reimbursedBy:'Manuel Felipe',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:141.95},
    {id:9400019,sourceKey:'planilha-reembolso-19',displayOrder:19,date:'2026-06-03',type:'saida',description:'1ª Parcela Seguro',status:'solicitado',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'TOKIO MARINE SEGURADORA S.A.',value:78.22},
    {id:9400020,sourceKey:'planilha-reembolso-20',displayOrder:20,date:'2026-06-22',type:'saida',description:'Certidão',status:'solicitado',receivedDate:'',reimbursedBy:'Patio Pitangueiras',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:77.89},
    {id:9400021,sourceKey:'planilha-reembolso-21',displayOrder:21,date:'2026-08-05',type:'saida',description:'Registro de Convenção',status:'solicitado',receivedDate:'',reimbursedBy:'Persona',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:77.89},
    {id:9400022,sourceKey:'planilha-reembolso-22',displayOrder:22,date:'2026-06-10',type:'saida',description:'Registro de Instituição Condominio',status:'solicitado',receivedDate:'',reimbursedBy:'Persona',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:77.69},
    {id:9400023,sourceKey:'planilha-reembolso-23',displayOrder:23,date:'2026-07-08',type:'saida',description:'Consultas',status:'solicitado',receivedDate:'',reimbursedBy:'Quinta do Golfe Jardins',paidBy:'SERASA S.A.',value:59.90},
    {id:9400024,sourceKey:'planilha-reembolso-24',displayOrder:24,date:'2026-08-12',type:'saida',description:'Consultas',status:'solicitado',receivedDate:'',reimbursedBy:'Quinta do Golfe Jardins',paidBy:'SERASA S.A.',value:59.90},
    {id:9400025,sourceKey:'planilha-reembolso-25',displayOrder:25,date:'2026-06-03',type:'saida',description:'1ª Parcela Seguro',status:'recebido',receivedDate:'2026-07-01',reimbursedBy:'Patio Pitangueiras',paidBy:'TOKIO MARINE SEGURADORA S.A.',value:1847.30},
    {id:9400026,sourceKey:'planilha-reembolso-26',displayOrder:26,date:'2026-06-03',type:'saida',description:'1ª Parcela Seguro',status:'recebido',receivedDate:'2026-07-01',reimbursedBy:'Persona',paidBy:'TOKIO MARINE SEGURADORA S.A.',value:1461.14},
    {id:9400027,sourceKey:'planilha-reembolso-27',displayOrder:27,date:'2026-06-29',type:'saida',description:'Registro de Ata',status:'recebido',receivedDate:'2026-07-01',reimbursedBy:'Assoc. dos Proprietarios do Recanto dos Curimbatás',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:116.42},
    {id:9400028,sourceKey:'planilha-reembolso-28',displayOrder:28,date:'2026-06-29',type:'saida',description:'Registro de Ata',status:'recebido',receivedDate:'2026-07-09',reimbursedBy:'Nova Smart',paidBy:'GIRO PAGAMENTOS E TECNOLOGIA LTDA',value:154.56},
    {id:9400029,sourceKey:'planilha-reembolso-29',displayOrder:29,date:'2026-05-28',type:'saida',description:'Produtos de limpeza',status:'recebido',receivedDate:'2026-06-01',reimbursedBy:'Hublot',paidBy:'KITLAR COMERCIO DE PRODUTOS LIMPEZA LTDA',value:226.20},
    {id:9400030,sourceKey:'planilha-reembolso-30',displayOrder:30,date:'2026-07-15',type:'saida',description:'Pix enviado errado',status:'recebido',receivedDate:'2026-07-27',reimbursedBy:'Clarice Ap. Lameiro',paidBy:'CLARICE APARECIDA LAMEIRO',value:340.51},
    {id:9400031,sourceKey:'planilha-reembolso-31',displayOrder:31,date:'2026-05-12',type:'saida',description:'Semae',status:'recebido',receivedDate:'2026-05-15',reimbursedBy:'Praça das Estações',paidBy:'SERVICO MUNICIPAL AUTONOMO DE AGUA E ESGOTO',value:854.58},
    {id:9400032,sourceKey:'planilha-reembolso-32',displayOrder:32,date:'2026-07-24',type:'saida',description:'Compra de Micro-ondas',status:'recebido',receivedDate:'2026-08-04',reimbursedBy:'Plaza Corporate',paidBy:'GRUPO CASAS BAHIA S.A.',value:899.00},
    {id:9400033,sourceKey:'planilha-reembolso-33',displayOrder:33,date:'2026-06-03',type:'saida',description:'Registro de Convenção',status:'recebido',receivedDate:'2026-06-05',reimbursedBy:'Quinta do Golfe Jardins',paidBy:'2 OFICIAL DE REGISTRO DE IMOVEIS DE SAO JOSE DO RIO PRETO',value:2339.74}
  ];

  function current(){
    try{if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements))return reimbursements}catch(_){ }
    return Array.isArray(window.reimbursements)?window.reimbursements:[];
  }
  function setCurrent(next){
    try{reimbursements=next}catch(_){window.reimbursements=next}
    try{localStorage.setItem('brcondos_reimbursements',JSON.stringify(next))}catch(_){ }
    try{if(typeof saveData==='function')saveData('reimbursements',next)}catch(_){ }
  }
  function needsCanonical(data){
    if(!Array.isArray(data)||!data.length)return true;
    return !data.some(r=>/^planilha-reembolso-\d+$/i.test(String(r?.sourceKey||'')));
  }
  function apply(){
    const data=current();
    if(!needsCanonical(data))return false;
    setCurrent(CANONICAL.map(x=>({...x})));
    try{if(typeof renderAll==='function')renderAll()}catch(_){ }
    return true;
  }

  apply();
  setTimeout(apply,40);
  setTimeout(apply,180);
})();