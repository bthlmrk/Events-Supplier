const config = window.EVENT_SUPPLIERS_CONFIG;
const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
const $ = id => document.getElementById(id);
let suppliers = [], categories = [], userCoords = null;
let activeReviewSupplier = null;
let activeSupplier = null;
let ownerMessengerUrl = null;

function esc(v='') { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function kmBetween(a,b){
  if(!a||!b||[a.lat,a.lng,b.lat,b.lng].some(v=>typeof v!=='number'||Number.isNaN(v))) return null;
  const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
  const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function avgRating(s){ const rs=s.reviews||[]; return rs.length?rs.reduce((a,r)=>a+Number(r.rating||0),0)/rs.length:0; }
function isFeaturedActive(s){ if(!s?.is_featured) return false; if((s.featured_plan||'')==='lifetime') return true; if(!s.featured_until) return !!s.is_featured; return new Date(s.featured_until).getTime()>Date.now(); }
function stars(n=0){ return '★'.repeat(Math.max(0,Math.min(5,Number(n)||0))) + '☆'.repeat(Math.max(0,5-(Number(n)||0))); }
function formatDate(v){ if(!v) return ''; const d=new Date(v); return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }

function assetUrl(s, file){
  const value=String(file||'').trim();
  if(!value) return '';
  if(/^https?:\/\//i.test(value) || value.startsWith('assets/')) return value;
  const folder=String(s?.asset_folder||'').trim();
  if(!folder) return '';
  const cleanFolder=folder.replace(/^\/+|\/+$/g,'');
  const cleanFile=value.replace(/^\/+/, '');
  return `assets/suppliers/${cleanFolder}/${cleanFile}`;
}

function toast(message,type='success'){
  const wrap=$('publicToastContainer'); if(!wrap) return;
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<div class="toast-icon">${type==='error'?'!':'✓'}</div><div class="toast-copy"><strong>${type==='error'?'Something went wrong':'Success'}</strong><span>${esc(message)}</span></div><button class="toast-close" type="button" aria-label="Close">×</button>`;
  wrap.appendChild(el); requestAnimationFrame(()=>el.classList.add('show'));
  const remove=()=>{el.classList.add('toast-out');setTimeout(()=>el.remove(),220)};
  el.querySelector('.toast-close').addEventListener('click',remove); setTimeout(remove,4200);
}

async function loadData(){
  $('resultSummary').textContent='Loading suppliers from Supabase…';
  const [{data:sData,error:sErr},{data:cData,error:cErr},{data:settingData}] = await Promise.all([
    db.from('suppliers').select(`*, supplier_categories(categories(id,name)), supplier_services(services(id,name)), supplier_gallery(id,image_url,sort_order,created_at), supplier_service_areas(id,province,city), supplier_contacts(id,platform,label,value,sort_order,is_active), reviews(id,rating,status,reviewer_name,message,created_at)`).eq('is_active',true).order('business_name'),
    db.from('categories').select('*').eq('is_active',true).order('name'),
    db.from('app_settings').select('*').eq('setting_key','owner_messenger_url').maybeSingle()
  ]);
  if(sErr||cErr){
    console.error(sErr||cErr); $('resultSummary').textContent='Unable to load database. Check Supabase connection/RLS.'; return;
  }
  categories=cData||[];
  const rawSetting=settingData?.setting_value; ownerMessengerUrl=typeof rawSetting==='string'?rawSetting:(rawSetting?.value||null);
  if(ownerMessengerUrl){$('ownerMessengerBtn').href=ownerMessengerUrl;$('ownerMessengerBtn').classList.remove('hidden');$('ownerMessengerMissing').classList.add('hidden');}
  suppliers=(sData||[]).map(s=>({
    ...s,
    category:s.supplier_categories?.[0]?.categories?.name||'',
    services:(s.supplier_services||[]).map(x=>x.services?.name).filter(Boolean),
    reviews:(s.reviews||[]).filter(r=>r.status==='approved').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),
    gallery:(s.supplier_gallery||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),
    serviceAreas:(s.supplier_service_areas||[]),
    contacts:(s.supplier_contacts||[]).filter(x=>x.is_active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),
    lat:s.latitude, lng:s.longitude
  }));
  renderCategories(); renderSuppliers(suppliers);
}

function renderCategories(){
  $('categoryGrid').innerHTML=categories.map(c=>`<button class="category-card" data-category="${esc(c.name)}"><span>${esc(c.name)}</span><small>Browse suppliers</small></button>`).join('');
  $('categoryFilter').innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  document.querySelectorAll('.category-card').forEach(btn=>btn.addEventListener('click',()=>{$('categoryFilter').value=btn.dataset.category;$('serviceSearch').value=btn.dataset.category;runSearch();document.querySelector('#suppliers').scrollIntoView({behavior:'smooth'});}));
}
function renderSuppliers(list){
  $('supplierGrid').innerHTML=''; $('emptyState').classList.toggle('hidden',list.length>0);
  list.forEach(s=>{
    const d=userCoords?kmBetween(userCoords,{lat:s.lat,lng:s.lng}):null, rating=avgRating(s);
    const div=document.createElement('article'); div.className='supplier-card';
    const cover=assetUrl(s,s.cover_image||'cover.jpg');
    const logo=assetUrl(s,s.logo_image||'logo.png');
    const initials=esc((s.business_name||'ES').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'ES');
    div.innerHTML=`<div class="supplier-cover"><div class="supplier-cover-placeholder">${esc((s.business_name||'ES').slice(0,2).toUpperCase())}</div>${cover?`<img class="supplier-cover-img" src="${esc(cover)}" alt="${esc(s.business_name)} cover" loading="lazy" onerror="this.style.display='none'">`:''}<div class="badge-row">${s.is_verified?'<span class="badge verified">Verified</span>':''}${isFeaturedActive(s)?'<span class="badge featured">Featured</span>':''}</div></div><div class="supplier-body"><div class="supplier-title-row"><div class="supplier-title-main"><div class="supplier-logo-wrap"><div class="supplier-logo-placeholder">${initials}</div>${logo?`<img class="supplier-logo" src="${esc(logo)}" alt="${esc(s.business_name)} logo" loading="lazy" onerror="this.style.display='none'">`:''}</div><div class="supplier-title-copy"><h3>${esc(s.business_name)}</h3><p class="supplier-location">${esc([s.city,s.province].filter(Boolean).join(', ')||s.address||'Location not set')}${d!==null?` · ${d.toFixed(1)} km away`:''}</p></div></div><span class="rating">★ ${rating.toFixed(1)}</span></div><div class="tags">${(s.services||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${s.description?`<p class="helper">${esc(s.description)}</p>`:''}<div class="review-summary-btn review-summary-static"><span class="review-stars">${stars(Math.round(rating))}</span><span>${s.reviews.length} review${s.reviews.length===1?'':'s'}</span></div><div class="card-actions"><button class="btn primary view-supplier-btn" type="button" data-view-supplier="${esc(s.id)}">View Supplier</button></div></div>`;
    $('supplierGrid').appendChild(div);
  });
  document.querySelectorAll('[data-view-supplier]').forEach(btn=>btn.addEventListener('click',()=>openSupplierModal(btn.dataset.viewSupplier)));
  $('resultSummary').textContent=`${list.length} supplier${list.length===1?'':'s'} found.`;
}
function runSearch(){
  const q=$('serviceSearch').value.trim().toLowerCase(), loc=$('locationSearch').value.trim().toLowerCase(), cat=$('categoryFilter').value, minRating=parseFloat($('ratingFilter').value||'0'), sort=$('sortFilter').value;
  let list=suppliers.filter(s=>!q||[s.business_name,s.category,...s.services].join(' ').toLowerCase().includes(q));
  if(loc) list=list.filter(s=>[s.address,s.city,s.province].join(' ').toLowerCase().includes(loc));
  if(cat) list=list.filter(s=>s.category===cat);
  list=list.filter(s=>avgRating(s)>=minRating);
  list.sort((a,b)=>{ const featuredDelta=Number(isFeaturedActive(b))-Number(isFeaturedActive(a)); if(featuredDelta) return featuredDelta; return sort==='rating'?avgRating(b)-avgRating(a):sort==='reviews'?b.reviews.length-a.reviews.length:sort==='az'?a.business_name.localeCompare(b.business_name):sort==='nearest'&&userCoords?(kmBetween(userCoords,{lat:a.lat,lng:a.lng})??99999)-(kmBetween(userCoords,{lat:b.lat,lng:b.lng})??99999):0; });
  renderSuppliers(list);
}

function contactPlatformLabel(c){
  const map={facebook:'Facebook',messenger:'Messenger',mobile:'Mobile Number',viber:'Viber',wechat:'WeChat',whatsapp:'WhatsApp',telegram:'Telegram',email:'Email',website:'Website',custom:'Other'};
  return c?.label || map[c?.platform] || c?.platform || 'Contact';
}
function digits(v=''){ return String(v).replace(/[^+\d]/g,''); }
function contactHref(c){
  const v=String(c?.value||'').trim(); if(!v) return '';
  if(/^https?:\/\//i.test(v) || /^(tel:|mailto:|viber:|tg:|weixin:)/i.test(v)) return v;
  switch(c.platform){
    case 'mobile': return `tel:${digits(v)}`;
    case 'email': return `mailto:${v}`;
    case 'whatsapp': return `https://wa.me/${digits(v).replace(/^\+/,'')}`;
    case 'telegram': return `https://t.me/${v.replace(/^@/,'')}`;
    case 'viber': return `viber://chat?number=${encodeURIComponent(digits(v))}`;
    case 'facebook': case 'messenger': case 'website': return /^www\./i.test(v)?`https://${v}`:'';
    default: return '';
  }
}
function renderSupplierContacts(s){
  let contacts=(s.contacts||[]).slice();
  if(!contacts.length){
    if(s.facebook_url) contacts.push({platform:'facebook',value:s.facebook_url});
    if(s.messenger_url) contacts.push({platform:'messenger',value:s.messenger_url});
    if(s.contact_number) contacts.push({platform:'mobile',value:s.contact_number});
  }
  if(!contacts.length) return '<div class="supplier-detail-empty">No contact options listed yet.</div>';
  return `<div class="supplier-contact-cards">${contacts.map(c=>{
    const label=contactPlatformLabel(c), href=contactHref(c), value=esc(c.value||'');
    return `<div class="supplier-contact-card"><div><span>${esc(label)}</span><strong>${value}</strong></div>${href?`<a class="btn secondary contact-open-btn" ${c.platform==='mobile'||c.platform==='email'?'': 'target="_blank" rel="noopener"'} href="${esc(href)}">${c.platform==='mobile'?'Call':c.platform==='email'?'Email':'Open'}</a>`:`<button type="button" class="btn secondary contact-copy-btn" data-copy-contact="${value}">Copy</button>`}</div>`;
  }).join('')}</div>`;
}
function renderSupplierReviews(s){
  const reviews=(s.reviews||[]).slice(0,3);
  if(!reviews.length) return '<div class="supplier-detail-empty">No approved reviews yet.</div>';
  return reviews.map(r=>`<article class="supplier-detail-review"><div><strong>${esc(r.reviewer_name||'Client')}</strong><span class="review-stars">${stars(r.rating)}</span></div><p>${esc(r.message||'')}</p><small>${esc(formatDate(r.created_at))}</small></article>`).join('');
}
function openSupplierModal(id){
  const s=suppliers.find(x=>String(x.id)===String(id)); if(!s) return;
  activeSupplier=s;
  const rating=avgRating(s), cover=assetUrl(s,s.cover_image||'cover.jpg'), logo=assetUrl(s,s.logo_image||'logo.png');
  const initials=esc((s.business_name||'ES').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'ES');
  const galleries=(s.gallery||[]).slice(0,3).map(g=>assetUrl(s,g.image_url)).filter(Boolean);
  const location=[s.city,s.province].filter(Boolean).join(', ')||s.address||'Location not set';
  const areas=(s.serviceAreas||[]).map(a=>[a.city,a.province].filter(Boolean).join(', ')).filter(Boolean);
  $('supplierModalContent').innerHTML=`
    <div class="supplier-detail-cover">
      <div class="supplier-detail-cover-placeholder">${esc((s.business_name||'ES').slice(0,2).toUpperCase())}</div>
      ${cover?`<img src="${esc(cover)}" alt="${esc(s.business_name)} cover" onerror="this.style.display='none'">`:''}
    </div>
    <div class="supplier-detail-body">
      <div class="supplier-detail-header">
        <div class="supplier-detail-logo-wrap"><div class="supplier-logo-placeholder">${initials}</div>${logo?`<img class="supplier-logo" src="${esc(logo)}" alt="${esc(s.business_name)} logo" onerror="this.style.display='none'">`:''}</div>
        <div class="supplier-detail-title"><h2>${esc(s.business_name)}</h2><p>${esc(location)}</p><div class="supplier-detail-rating"><span>★ ${rating.toFixed(1)}</span><span>${s.reviews.length} review${s.reviews.length===1?'':'s'}</span></div></div>
      </div>
      ${s.description?`<p class="supplier-detail-description">${esc(s.description)}</p>`:''}
      <section class="supplier-detail-section"><h3>Services</h3><div class="tags">${(s.services||[]).length?(s.services||[]).map(x=>`<span>${esc(x)}</span>`).join(''):'<span>No service tags listed.</span>'}</div></section>
      ${areas.length?`<section class="supplier-detail-section"><h3>Service Areas</h3><p>${areas.map(esc).join(' · ')}</p></section>`:''}
      <section class="supplier-detail-section"><h3>Contact Supplier</h3>
        ${s.address?`<div class="supplier-contact-address"><span>Address</span><strong>${esc(s.address)}</strong></div>`:''}
        ${renderSupplierContacts(s)}
      </section>
      <section class="supplier-detail-section"><div class="supplier-section-heading"><h3>Gallery</h3><span>${galleries.length?`${galleries.length} photo${galleries.length===1?'':'s'}`:'No photos yet'}</span></div>
        ${galleries.length?`<div class="supplier-detail-gallery gallery-count-${Math.min(galleries.length,3)}">${galleries.map((url,i)=>`<button type="button" class="gallery-thumb" data-gallery-url="${esc(url)}" aria-label="Open gallery photo ${i+1}"><img src="${esc(url)}" alt="${esc(s.business_name)} gallery ${i+1}" onerror="this.closest('.gallery-thumb').style.display='none'"></button>`).join('')}</div>`:'<div class="supplier-detail-empty">Gallery photos have not been added yet.</div>'}
      </section>
      <section class="supplier-detail-section"><div class="supplier-section-heading"><h3>Reviews</h3><span>Showing up to 3 latest approved reviews</span></div><div class="supplier-detail-reviews">${renderSupplierReviews(s)}</div><button class="btn primary leave-review-from-detail" type="button" data-review-from-detail="${esc(s.id)}">Leave a Review</button></section>
    </div>`;
  $('supplierModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('supplierModal').querySelector('[data-review-from-detail]')?.addEventListener('click',e=>{const supplierId=e.currentTarget.dataset.reviewFromDetail; closeSupplierModal(); openReviewModal(supplierId);});
  $('supplierModal').querySelectorAll('[data-gallery-url]').forEach(btn=>btn.addEventListener('click',()=>openGalleryLightbox(btn.dataset.galleryUrl,s.business_name)));
  $('supplierModal').querySelectorAll('[data-copy-contact]').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copyContact||''); toast('Contact detail copied.','success');}catch{toast('Could not copy contact detail.','error');}}));
}
function closeSupplierModal(){ $('supplierModal').classList.add('hidden'); activeSupplier=null; document.body.classList.remove('modal-open'); }
function openGalleryLightbox(url,name){ $('galleryLightboxImage').src=url; $('galleryLightboxImage').alt=`${name||'Supplier'} gallery photo`; $('galleryLightbox').classList.remove('hidden'); }
function closeGalleryLightbox(){ $('galleryLightbox').classList.add('hidden'); $('galleryLightboxImage').src=''; }

function setRating(value){
  const rating=Number(value)||0; $('reviewRating').value=rating||'';
  document.querySelectorAll('.star-btn').forEach(btn=>{
    const active=Number(btn.dataset.rating)<=rating;
    btn.classList.toggle('active',active); btn.setAttribute('aria-checked',String(Number(btn.dataset.rating)===rating));
  });
  $('ratingHelp').textContent=rating?`${rating} star${rating===1?'':'s'} selected.`:'Select 1 to 5 stars.';
}
function renderReviewPreview(s){
  const box=$('approvedReviewPreview'); const rs=(s?.reviews||[]).slice(0,3);
  if(!rs.length){ box.innerHTML='<div class="review-preview-empty">No approved reviews yet. You can be the first to submit one.</div>'; return; }
  box.innerHTML=`<div class="review-preview-head"><strong>Recent approved reviews</strong><span>★ ${avgRating(s).toFixed(1)} (${s.reviews.length})</span></div>`+rs.map(r=>`<article class="review-preview-item"><div class="review-preview-meta"><strong>${esc(r.reviewer_name||'Client')}</strong><span class="review-stars">${stars(r.rating)}</span></div><p>${esc(r.message||'')}</p><small>${esc(formatDate(r.created_at))}</small></article>`).join('');
}
function openReviewModal(id){
  const s=suppliers.find(x=>String(x.id)===String(id)); if(!s) return;
  activeReviewSupplier=s; $('reviewSupplierId').value=s.id; $('reviewSupplierName').textContent=s.business_name;
  $('reviewerName').value=''; $('reviewMessage').value=''; $('reviewWebsite').value=''; $('reviewCharCount').textContent='0'; setRating(0); renderReviewPreview(s);
  $('reviewModal').classList.remove('hidden'); setTimeout(()=>$('reviewerName').focus(),50);
}
function closeReviewModal(){ $('reviewModal').classList.add('hidden'); activeReviewSupplier=null; $('publicReviewForm').reset(); setRating(0); }

$('closeSupplierModalBtn').addEventListener('click',closeSupplierModal);
$('closeGalleryLightboxBtn').addEventListener('click',closeGalleryLightbox);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('galleryLightbox').classList.contains('hidden')) closeGalleryLightbox(); else if(e.key==='Escape'&&!$('supplierModal').classList.contains('hidden')) closeSupplierModal();});
document.querySelectorAll('.star-btn').forEach(btn=>btn.addEventListener('click',()=>setRating(btn.dataset.rating)));
$('reviewMessage').addEventListener('input',()=>{$('reviewCharCount').textContent=$('reviewMessage').value.length;});
$('closeReviewModalBtn').addEventListener('click',closeReviewModal); $('cancelReviewBtn').addEventListener('click',closeReviewModal);
$('reviewModal').addEventListener('click',e=>{ if(e.target===$('reviewModal')) closeReviewModal(); });
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('reviewModal').classList.contains('hidden')) closeReviewModal();});
$('publicReviewForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if($('reviewWebsite').value) return; // basic bot trap
  const supplierId=$('reviewSupplierId').value, reviewerName=$('reviewerName').value.trim(), rating=Number($('reviewRating').value), message=$('reviewMessage').value.trim();
  if(!supplierId||!reviewerName||!rating||rating<1||rating>5||!message){ toast('Please complete your name, rating, and short review.','error'); return; }
  const btn=$('submitReviewBtn'); btn.disabled=true; btn.textContent='Submitting…';
  try{
    const {error}=await db.from('reviews').insert({supplier_id:supplierId,reviewer_name:reviewerName,rating,message,status:'pending'});
    if(error) throw error;
    closeReviewModal(); toast('Review submitted successfully. It will appear after Admin approval.','success');
  }catch(err){ console.error(err); toast(`Review could not be submitted: ${err.message||err}`,'error'); }
  finally{ btn.disabled=false; btn.textContent='Submit Review'; }
});

$('searchBtn').addEventListener('click',runSearch); $('serviceSearch').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch();}); $('locationSearch').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch();}); ['categoryFilter','ratingFilter','sortFilter'].forEach(id=>$(id).addEventListener('change',runSearch));

$('contactTicketForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const btn=$('submitTicketBtn'); btn.disabled=true; btn.textContent='Submitting…';
  try{
    const payload={request_type:$('ticketType').value,name:$('ticketName').value.trim(),business_name:$('ticketBusinessName').value.trim()||null,email:$('ticketEmail').value.trim()||null,contact_number:$('ticketContact').value.trim()||null,message:$('ticketMessage').value.trim(),status:'pending'};
    if(!payload.request_type||!payload.name||!payload.message) throw new Error('Please complete the request type, your name, and message.');
    const {error}=await db.from('contact_tickets').insert(payload); if(error) throw error;
    e.target.reset(); toast('Ticket submitted successfully. The admin can now review your request.','success');
  }catch(err){console.error(err);toast(`Ticket could not be submitted: ${err.message||err}`,'error');}
  finally{btn.disabled=false;btn.textContent='Submit Ticket';}
});
$('nearMeBtn').addEventListener('click',()=>{if(!navigator.geolocation){$('locationStatus').textContent='Geolocation is not supported by this browser.';return;}$('locationStatus').textContent='Requesting your location…';navigator.geolocation.getCurrentPosition(pos=>{userCoords={lat:pos.coords.latitude,lng:pos.coords.longitude};$('locationStatus').textContent='Location enabled. Results are sorted by distance.';$('sortFilter').value='nearest';runSearch();},()=>{$('locationStatus').textContent='Location permission was not granted. You can type the event city instead.';});});
loadData();
