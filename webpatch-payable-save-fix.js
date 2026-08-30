(function(){
  async function uploadAttachmentData(fileName,dataUrl){
    const r=await fetch('/api/payables/attachments',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({fileName,dataUrl})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Não foi possível salvar o anexo.');
    if(!d.id)throw new Error('O servidor não retornou a referência do anexo.');
    return d;
  }

  async function uploadAttachmentFile(file){
    const payload=await fileToData(file);
    if(!payload)return null;
    return await uploadAttachmentData(payload.name,payload.data);
  }

  function syncEditedPaidPayableToFlow(obj){
    if(!obj||obj.status!=='pago'||typeof transactions==='undefined'||!Array.isArray(transactions))return false;

    const payableId=String(obj.id||'');
    let flow=null;

    if(obj.flowId!==undefined&&obj.flowId!==null&&String(obj.flowId)!==''){
      flow=transactions.find(t=>String(t?.id||'')===String(obj.flowId));
    }
    if(!flow){
      flow=transactions.find(t=>String(t?.sourcePayableId||t?.payableId||'')===payableId);
    }

    if(!flow)return false;

    const fine=Math.max(0,Number(obj.paymentFine||0));
    const interest=Math.max(0,Number(obj.paymentInterest||0));
    const base=Number(obj.value||0);
    const total=base+fine+interest;

    flow.type='saida';
    flow.date=obj.paymentDate||flow.date||obj.due||'';
    flow.description=obj.description||flow.description||'Conta a pagar';
    flow.category=obj.category||flow.category||'Contas a pagar';
    flow.party=obj.supplier||flow.party||'';
    flow.value=total;
    flow.baseValue=base;
    flow.fine=fine;
    flow.interest=interest;
    flow.status='pago';
    flow.sourceType='payable';
    flow.sourcePayableId=obj.id;

    obj.flowId=flow.id;
    obj.paidTotal=total;

    saveData('transactions',transactions);
    return true;
  }

  window.openAttachment=function(id){
    const p=payables.find(x=>x.id===id);
    if(!p)return alert('Conta não encontrada.');
    if(p.attachmentRef){
      const a=document.createElement('a');
      a.href=`/api/payables/attachments/${encodeURIComponent(p.attachmentRef)}`;
      a.download=p.attachmentName||'anexo';
      document.body.appendChild(a);a.click();a.remove();
      return;
    }
    if(p.attachmentData){
      const a=document.createElement('a');
      a.href=p.attachmentData;
      a.download=p.attachmentName||'anexo';
      document.body.appendChild(a);a.click();a.remove();
      return;
    }
    alert('Esta conta não possui anexo.');
  };

  window.savePayable=async function(id){
    const saveBtn=[...document.querySelectorAll('#modalRoot .btn.primary,#modal .btn.primary,.modal .btn.primary')]
      .find(b=>String(b.textContent||b.value||'').trim().toLowerCase()==='salvar');
    try{
      if(saveBtn){saveBtn.disabled=true;saveBtn.dataset.oldText=saveBtn.textContent||'';if(saveBtn.textContent)saveBtn.textContent='Salvando...';}

      const old=id?payables.find(x=>x.id===id):null;
      const recurring=!!document.getElementById('ap_recurring')?.checked;
      const repeatCount=recurring?Math.max(2,Math.min(60,Number(val('ap_repeat')||12))):1;
      const attachmentEl=document.getElementById('ap_attachment');
      let attachmentName=old?.attachmentName||'';
      let attachmentRef=old?.attachmentRef||'';

      if(!attachmentRef&&old?.attachmentData){
        const migrated=await uploadAttachmentData(attachmentName||'anexo',old.attachmentData);
        attachmentRef=migrated.id;
        attachmentName=migrated.fileName||attachmentName||'anexo';
      }

      if(attachmentEl?.files?.[0]){
        const uploaded=await uploadAttachmentFile(attachmentEl.files[0]);
        if(uploaded){
          attachmentRef=uploaded.id;
          attachmentName=uploaded.fileName||attachmentEl.files[0].name;
        }
      }

      const value=(typeof parseMoneyBR==='function')?parseMoneyBR(val('ap_value')):Number(String(val('ap_value')||'').replace(/\./g,'').replace(',','.'));
      const obj={
        ...(old||{}),
        id:id||Date.now(),
        due:val('ap_due'),
        supplier:val('ap_supplier'),
        description:val('ap_desc'),
        category:val('ap_cat'),
        value,
        paymentMethod:val('ap_method'),
        status:val('ap_status'),
        notes:val('ap_notes'),
        flowId:old?.flowId||null,
        recurring,
        frequency:recurring?val('ap_frequency'):'monthly',
        repeatCount,
        recurrenceGroup:old?.recurrenceGroup||null,
        pixCode:val('ap_pix'),
        barcode:val('ap_barcode'),
        scheduledDate:val('ap_scheduled'),
        paymentDate:old?.paymentDate||'',
        attachmentName,
        attachmentRef,
        attachmentData:''
      };

      if(!obj.due||!obj.description||!Number.isFinite(obj.value)||obj.value<=0){
        return alert('Preencha vencimento, descrição e valor.');
      }

      if(obj.status==='pago'){
        const fine=Math.max(0,Number(obj.paymentFine||0));
        const interest=Math.max(0,Number(obj.paymentInterest||0));
        obj.paidTotal=Number(obj.value||0)+fine+interest;
      }

      if(id){
        payables=payables.map(x=>x.id===id?obj:x);
      }else if(recurring){
        const group='rec-'+Date.now();
        const baseId=Date.now();
        const items=[];
        for(let i=0;i<repeatCount;i++){
          items.push({
            ...obj,
            id:baseId+i,
            due:addPeriod(obj.due,obj.frequency,i),
            recurrenceGroup:group,
            flowId:null,
            paymentDate:'',
            paymentFine:0,
            paymentInterest:0,
            paidTotal:null
          });
        }
        payables.push(...items);
      }else{
        payables.push(obj);
      }

      saveData('payables',payables);

      if(obj.status==='pago'&&id){
        let synced=syncEditedPaidPayableToFlow(obj);
        if(!synced&&typeof syncPayableToFlow==='function'){
          syncPayableToFlow(obj.id);
          synced=syncEditedPaidPayableToFlow(obj);
        }
        if(synced){
          payables=payables.map(x=>x.id===obj.id?{...x,flowId:obj.flowId,paidTotal:obj.paidTotal}:x);
          saveData('payables',payables);
        }
      }

      closeModal();
      renderAll();
    }catch(err){
      console.error('BRCONDOS SAVE PAYABLE:',err);
      alert('Não foi possível salvar esta conta. '+(err?.message||'Tente novamente.'));
    }finally{
      if(saveBtn&&document.body.contains(saveBtn)){
        saveBtn.disabled=false;
        if(saveBtn.textContent)saveBtn.textContent=saveBtn.dataset.oldText||'Salvar';
      }
    }
  };
})();
