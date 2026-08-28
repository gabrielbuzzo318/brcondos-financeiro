(function(){
  function fixBoletoActions(){
    document.querySelectorAll('#view-boletos tbody tr .actions').forEach(actions=>{
      Object.assign(actions.style,{
        display:'flex',
        alignItems:'center',
        justifyContent:'flex-end',
        gap:'6px',
        flexWrap:'nowrap',
        minWidth:'max-content',
        width:'max-content'
      });

      const cell=actions.closest('td');
      if(cell){
        cell.style.whiteSpace='nowrap';
        cell.style.width='1%';
      }

      actions.querySelectorAll('button,a').forEach(btn=>{
        Object.assign(btn.style,{
          flex:'0 0 auto',
          whiteSpace:'nowrap',
          width:'auto',
          minWidth:'auto',
          overflow:'visible',
          textOverflow:'clip'
        });

        const onclick=String(btn.getAttribute('onclick')||'');
        if(onclick.includes('openBoleto(')) btn.textContent='Editar';
        else if(onclick.includes('emitSicrediBoleto(')) btn.textContent='Emitir';
        else if(onclick.includes('printBoleto(')) btn.textContent='PDF';
        else if(onclick.includes('consultSicrediBoleto(')) btn.textContent='Consultar';
        else if(onclick.includes('payBoleto(')) btn.textContent='Receber';
        else if(onclick.includes('delBoleto(')) btn.textContent='Excluir';
      });
    });
  }

  const oldRender=window.renderBoletos;
  if(typeof oldRender==='function'){
    window.renderBoletos=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(fixBoletoActions,0);
      return out;
    };
  }

  setTimeout(fixBoletoActions,0);
})();