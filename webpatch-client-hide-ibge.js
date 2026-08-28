(function(){
  function hideIbgeFields(root=document){
    const scope=root&&root.querySelectorAll?root:document;

    // Esconde qualquer bloco de formulário identificado visualmente como IBGE.
    scope.querySelectorAll('label').forEach(label=>{
      const text=String(label.textContent||'').trim();
      if(!/IBGE/i.test(text))return;
      const wrapper=label.closest('.field,.form-group,.input-group,.form-field,.col,.col-6,.col-4')||label.parentElement;
      if(wrapper){
        wrapper.style.display='none';
        wrapper.setAttribute('data-brcondos-hidden-ibge','1');
        wrapper.querySelectorAll('input,select,textarea').forEach(el=>el.removeAttribute('required'));
      }
    });

    // Segurança para campos cujo label não esteja associado diretamente.
    scope.querySelectorAll('input,select,textarea').forEach(el=>{
      const key=`${el.id||''} ${el.name||''} ${el.placeholder||''}`;
      if(!/ibge/i.test(key))return;
      el.removeAttribute('required');
      const wrapper=el.closest('.field,.form-group,.input-group,.form-field,.col,.col-6,.col-4')||el.parentElement;
      if(wrapper){
        wrapper.style.display='none';
        wrapper.setAttribute('data-brcondos-hidden-ibge','1');
      }
    });
  }

  function scheduleHide(){
    requestAnimationFrame(()=>hideIbgeFields(document));
    setTimeout(()=>hideIbgeFields(document),80);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleHide,{once:true});
  else scheduleHide();

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.addedNodes&&m.addedNodes.length){scheduleHide();break;}
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();