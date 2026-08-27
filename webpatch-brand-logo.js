(function(){
  const LOGO='https://upload.wikimedia.org/wikipedia/commons/c/cf/Logo_BRCondos_svg.svg';

  function replaceLogo(el,cls,style){
    if(!el)return;
    if(el.tagName==='IMG'){
      el.src=LOGO;
      el.alt='BRCONDOS';
      if(style)el.style.cssText=style;
      return;
    }
    const img=document.createElement('img');
    img.src=LOGO;
    img.alt='BRCONDOS';
    if(cls)img.className=cls;
    if(style)img.style.cssText=style;
    el.replaceWith(img);
  }

  function applyBrand(){
    document.querySelectorAll('.brand-logo').forEach(el=>replaceLogo(el,'brand-logo','display:block;width:160px;height:134px;margin:0 auto 10px;object-fit:contain'));
    document.querySelectorAll('.login-logo').forEach(el=>replaceLogo(el,'login-logo','display:block;width:175px;max-width:100%;height:auto;margin:0 auto 8px;object-fit:contain'));

    const brand=document.querySelector('#app .brand');
    if(brand&&!brand.querySelector('img[data-brcondos-logo="1"]')){
      brand.innerHTML='';
      const img=document.createElement('img');
      img.src=LOGO;
      img.alt='BRCONDOS';
      img.dataset.brcondosLogo='1';
      img.style.cssText='display:block;width:145px;max-width:100%;height:auto;margin:0 auto 2px;object-fit:contain';
      const small=document.createElement('small');
      small.textContent='Financeiro - Sjrp';
      brand.append(img,small);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
  else applyBrand();
  setTimeout(applyBrand,250);
})();
