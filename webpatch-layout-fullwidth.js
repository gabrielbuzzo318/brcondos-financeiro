(function(){
  function ensureFullWidthStyles(){
    if(document.getElementById('br-fullwidth-layout-style'))return;
    const style=document.createElement('style');
    style.id='br-fullwidth-layout-style';
    style.textContent=`
      /* Aproveita toda a área útil do monitor sem colar o conteúdo nas bordas */
      #app .content{
        width:100%!important;
        max-width:none!important;
        margin:0!important;
        padding:20px 18px 34px!important;
      }
      #app .topbar{
        padding-left:18px!important;
        padding-right:18px!important;
      }
      #app .view{
        width:100%!important;
        max-width:none!important;
      }
      #app .card,
      #app .table-wrap,
      #app .filter-bar,
      #app .section-title{
        max-width:none!important;
      }
      #app .cards.grid{
        width:100%;
      }
      #app .table-wrap table{
        width:100%!important;
      }
      /* Em telas grandes, reduz um pouco o respiro vertical e deixa o painel mais "ERP" */
      @media (min-width:1200px){
        #app .content{padding:18px 16px 32px!important;}
        #app .topbar{padding-left:16px!important;padding-right:16px!important;}
        #app .card{padding:16px;}
        #app .cards{gap:14px;margin-bottom:14px;}
        #app .grid{gap:14px;}
      }
      /* Mantém conforto em notebook e celular */
      @media (max-width:1050px){
        #app .content{padding:18px 14px 30px!important;}
      }
      @media (max-width:760px){
        #app .content{padding:14px 10px 24px!important;}
        #app .topbar{padding-left:10px!important;padding-right:10px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureFullWidthStyles,{once:true});
  else ensureFullWidthStyles();
  setTimeout(ensureFullWidthStyles,500);
})();