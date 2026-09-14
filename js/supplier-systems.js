const config = window.EVENT_SUPPLIERS_CONFIG;
const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
const $ = id => document.getElementById(id);

function toast(message,type='success'){
  const box=$('publicToastContainer'); if(!box) return;
  const item=document.createElement('div'); item.className=`toast ${type}`;
  item.innerHTML=`<div class="toast-icon">${type==='success'?'✓':'!'}</div><div class="toast-copy"><strong>${type==='success'?'Success':'Error'}</strong><span>${String(message).replace(/[<>&]/g,'')}</span></div><button class="toast-close" type="button">×</button>`;
  box.appendChild(item); requestAnimationFrame(()=>item.classList.add('show'));
  const remove=()=>{item.classList.add('toast-out');setTimeout(()=>item.remove(),220)};
  item.querySelector('.toast-close').addEventListener('click',remove); setTimeout(remove,4200);
}
function openInquiry(product='Photobooth Booking System'){
  $('systemProduct').value=product;
  $('systemMessage').value=`I am interested in the ${product}.`;
  $('systemsContactModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(()=>$('systemName').focus(),40);
}
function closeInquiry(){ $('systemsContactModal').classList.add('hidden'); document.body.classList.remove('modal-open'); }

document.querySelectorAll('[data-avail-system]').forEach(btn=>btn.addEventListener('click',()=>openInquiry(btn.dataset.availSystem)));
$('systemsContactNav')?.addEventListener('click',e=>{e.preventDefault();openInquiry();});
$('closeSystemsContactBtn')?.addEventListener('click',closeInquiry);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('systemsContactModal').classList.contains('hidden')) closeInquiry();});

$('systemsInquiryForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const btn=$('submitSystemInquiry'); btn.disabled=true; btn.textContent='Submitting…';
  try{
    const product=$('systemProduct').value;
    const payload={
      request_type:'supplier_system',
      name:$('systemName').value.trim(),
      business_name:$('systemBusiness').value.trim()||null,
      email:$('systemEmail').value.trim()||null,
      contact_number:$('systemContact').value.trim()||null,
      message:`System: ${product}\n${$('systemMessage').value.trim()}`,
      status:'pending'
    };
    if(!payload.name||!$('systemMessage').value.trim()) throw new Error('Please enter your name and message.');
    const {error}=await db.from('contact_tickets').insert(payload); if(error) throw error;
    e.target.reset(); $('systemProduct').value='Photobooth Booking System'; closeInquiry(); toast('System inquiry submitted successfully. The admin can now review it.');
  }catch(err){console.error(err);toast(`Inquiry could not be submitted: ${err.message||err}`,'error');}
  finally{btn.disabled=false;btn.textContent='Submit Inquiry';}
});
