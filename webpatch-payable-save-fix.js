(function(){
  window.savePayable=async function(id){
    try{
      const old=id?payables.find(x=>x.id===id):null;
      const recurring=!!document.getElementById('ap_recurring')?.checked;
      const repeatCount=recurring?Math.max(2,Math.min(60,Number(val('ap_repeat')||12))):1;
      const attachmentEl=document.getElementById('ap_attachment');
      let attachmentName=old?.attachmentName||'';
      let attachmentData=old?.attachmentData||'';

      if(attachmentEl?.files?.[0]){
        const payload=await fileToData(attachmentEl.files[0]);
        if(payload){attachmentName=payload.name;attachmentData=payload.data;}
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
        attachmentData
      };

      if(!obj.due||!obj.description||!Number.isFinite(obj.value)||obj.value<=0){
        return alert('Preencha vencimento, descrição e valor.');
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

      if(obj.status==='pago'&&id&&!obj.flowId&&typeof syncPayableToFlow==='function'){
        syncPayableToFlow(obj.id);
      }

      closeModal();
      renderAll();
    }catch(err){
      console.error('BRCONDOS SAVE PAYABLE:',err);
      alert('Não foi possível salvar esta conta. '+(err?.message||'Tente novamente.'));
    }
  };
})();
