(function(){
  const escNote=v=>String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function periodLabel(){
    const el=document.getElementById('dre_month');
    return el?.selectedOptions?.[0]?.textContent||el?.value||'';
  }

  function currentPeriod(){
    return String(document.getElementById('dre_month')?.value||'').trim();
  }

  function formatDateTime(v){
    try{
      return new Date(v).toLocaleString('pt-BR',{
        timeZone:'America/Sao_Paulo',
        day:'2-digit',month:'2-digit',year:'numeric',
        hour:'2-digit',minute:'2-digit'
      });
    }catch(_){return String(v||'');}
  }

  function renderHistory(notes){
    const box=document.getElementById('dre_notes_history');
    if(!box)return;
    if(!notes?.length){
      box.innerHTML='<div class="subtle" style="padding:12px 0">Nenhuma anotação registrada neste período.</div>';
      return;
    }
    box.innerHTML=notes.map(n=>`
      <div style="padding:12px 0;border-top:1px solid #e5eaee">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
          <b>${escNote(n.author_name||'Usuário')}</b>
          <span class="subtle">${escNote(formatDateTime(n.created_at))}</span>
        </div>
        <div style="white-space:pre-wrap;line-height:1.5">${escNote(n.note)}</div>
      </div>`).join('');
  }

  async function loadNotes(period){
    const history=document.getElementById('dre_notes_history');
    if(history)history.innerHTML='<div class="subtle" style="padding:12px 0">Carregando anotações...</div>';
    try{
      const r=await fetch(`/api/dre/notes?period=${encodeURIComponent(period)}`,{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Não foi possível carregar as anotações.');
      if(currentPeriod()!==period)return;
      const composer=document.getElementById('dre_notes_composer');
      if(composer)composer.style.display=d.canWrite?'block':'none';
      const readonly=document.getElementById('dre_notes_readonly');
      if(readonly)readonly.style.display=d.canWrite?'none':'block';
      renderHistory(d.notes||[]);
    }catch(err){
      if(history)history.innerHTML=`<div class="notice" style="margin-top:8px">${escNote(err.message||'Erro ao carregar anotações.')}</div>`;
    }
  }

  async function saveNote(){
    const period=currentPeriod();
    const area=document.getElementById('dre_note_text');
    const btn=document.getElementById('dre_note_save');
    const note=String(area?.value||'').trim();
    if(!period)return alert('Selecione o período da DRE.');
    if(!note)return alert('Digite uma anotação.');
    if(note.length>3000)return alert('A anotação deve ter no máximo 3.000 caracteres.');
    if(btn){btn.disabled=true;btn.value='Salvando...';}
    try{
      const r=await fetch('/api/dre/notes',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({period,note})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Não foi possível salvar a anotação.');
      if(area)area.value='';
      await loadNotes(period);
    }catch(err){
      alert(err.message||'Não foi possível salvar a anotação.');
    }finally{
      if(btn){btn.disabled=false;btn.value='Salvar anotação';}
    }
  }

  function mountNotes(){
    const view=document.getElementById('view-dre');
    const period=currentPeriod();
    if(!view||!period)return;
    document.getElementById('dre_notes_card')?.remove();
    const card=document.createElement('div');
    card.id='dre_notes_card';
    card.className='card';
    card.style.marginTop='14px';
    card.innerHTML=`
      <div class="panel-title">Anotações — ${escNote(periodLabel())}</div>
      <div class="subtle" style="margin-bottom:12px">Histórico da DRE deste período. Cada anotação registra automaticamente o usuário, a data e o horário.</div>
      <div id="dre_notes_composer" style="display:none;margin-bottom:14px">
        <textarea id="dre_note_text" rows="4" maxlength="3000" placeholder="Escreva uma observação sobre a DRE deste mês..." style="width:100%;resize:vertical"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <input id="dre_note_save" type="button" class="btn primary" value="Salvar anotação">
        </div>
      </div>
      <div id="dre_notes_readonly" class="notice" style="display:none;margin-bottom:12px">Você pode consultar o histórico de anotações, mas seu usuário não tem permissão para escrever neste campo.</div>
      <div id="dre_notes_history"></div>`;
    view.appendChild(card);
    document.getElementById('dre_note_save')?.addEventListener('click',saveNote);
    loadNotes(period);
  }

  const originalRenderDRE=window.renderDRE;
  if(typeof originalRenderDRE==='function'){
    window.renderDRE=function(){
      const out=originalRenderDRE.apply(this,arguments);
      setTimeout(mountNotes,0);
      return out;
    };
  }

  setTimeout(mountNotes,0);
})();
