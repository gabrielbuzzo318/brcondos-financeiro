(function(){
  const CLOSING_KEY='brcondos_dre_closures_v1';
  let sharing=false;

  function currentPrefix(){
    return String(document.getElementById('dre_month')?.value||'').trim();
  }
  function wasClosed(prefix){
    try{
      const state=JSON.parse(localStorage.getItem(CLOSING_KEY)||'{}');
      return state?.[prefix]?.closed===true;
    }catch(_){return false;}
  }
  function periodLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${months[(m||1)-1]||''}/${y||''}`;
  }
  function messageFor(prefix){
    return `O mês ${periodLabel(prefix)} da Comarc Rio Preto foi finalizado e a DRE concluída! ✅\n\nVocê já pode consultar direto pelo sistema ou aqui no anexo 👇🏻`;
  }
  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function fallbackWhatsApp(message,pdf){
    downloadBlob(pdf.blob,pdf.filename);
    const url='https://wa.me/?text='+encodeURIComponent(message);
    const a=document.createElement('a');
    a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>{
      alert('O WhatsApp foi aberto com a mensagem pronta e o PDF foi baixado. Neste navegador, o WhatsApp não permite anexar o arquivo automaticamente; basta anexar o PDF baixado à conversa da diretoria.');
    },250);
  }

  window.brShareClosedDreToWhatsApp=async function(prefix){
    if(sharing)return;
    sharing=true;
    try{
      if(typeof window.brBuildDrePdf!=='function')throw new Error('Gerador de PDF da DRE não está disponível.');
      const pdf=await window.brBuildDrePdf();
      const message=messageFor(prefix);
      const shareData={title:`DRE BRCONDOS - ${periodLabel(prefix)}`,text:message,files:[pdf.file]};

      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[pdf.file]})){
        try{
          await navigator.share(shareData);
          return;
        }catch(err){
          if(err?.name==='AbortError')return;
        }
      }
      await fallbackWhatsApp(message,pdf);
    }catch(err){
      alert(err?.message||'Não foi possível preparar o envio da DRE para a diretoria.');
    }finally{
      sharing=false;
    }
  };

  const previousToggle=window.toggleDreClosing;
  if(typeof previousToggle==='function'){
    window.toggleDreClosing=function(){
      const prefix=currentPrefix();
      const before=/^\d{4}-\d{2}$/.test(prefix)?wasClosed(prefix):false;
      const out=previousToggle.apply(this,arguments);
      const after=/^\d{4}-\d{2}$/.test(prefix)?wasClosed(prefix):false;

      if(!before&&after){
        setTimeout(()=>{
          if(confirm('Enviar relatório para diretoria?')){
            window.brShareClosedDreToWhatsApp(prefix);
          }
        },80);
      }
      return out;
    };
  }
})();