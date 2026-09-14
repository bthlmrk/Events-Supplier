const $ = (id) => document.getElementById(id);
const config = window.EVENT_SUPPLIERS_CONFIG;
const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

let suppliers = [];
let categories = [];
let services = [];
let reviews = [];
let serviceAreas = [];
let gallery = [];
let auditLogs = [];
let tickets = [];
let selectedServiceIds = new Set();
let supplierMap = null;
let supplierMarker = null;
let editingContacts = [];

function toast(message, type='info') {
  const container = $('adminToastContainer');
  if (!container) { console.log(`[${type}] ${message}`); return; }
  const icons = { success: '✓', error: '!', info: 'i', warning: '!' };
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.setAttribute('role', 'status');
  item.innerHTML = `
    <span class="toast-icon">${icons[type] || 'i'}</span>
    <div class="toast-copy"><strong>${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'}</strong><span>${esc(message)}</span></div>
    <button class="toast-close" type="button" aria-label="Close notification">×</button>`;
  const close = () => { item.classList.add('toast-out'); setTimeout(() => item.remove(), 220); };
  item.querySelector('.toast-close').addEventListener('click', close);
  container.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(close, type === 'error' ? 5200 : 3400);
}

function esc(v='') { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function slugify(v='') { return v.toLowerCase().trim().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

const CONTACT_PLATFORMS = [
  ['facebook','Facebook'],['messenger','Messenger'],['mobile','Mobile Number'],['viber','Viber'],
  ['wechat','WeChat'],['whatsapp','WhatsApp'],['telegram','Telegram'],['email','Email'],['website','Website'],['custom','Other / Custom']
];
function blankContact(){ return {platform:'facebook',label:'',value:''}; }
function renderContactMethodsEditor(){
  const box=$('contactMethodsEditor'); if(!box) return;
  if(!editingContacts.length) editingContacts=[blankContact()];
  box.innerHTML=editingContacts.map((c,i)=>`<div class="contact-method-row" data-contact-row="${i}">
    <select class="contact-platform" data-contact-platform="${i}">${CONTACT_PLATFORMS.map(([v,l])=>`<option value="${v}" ${c.platform===v?'selected':''}>${l}</option>`).join('')}</select>
    <input class="contact-value" data-contact-value="${i}" value="${esc(c.value||'')}" placeholder="${c.platform==='mobile'?'e.g. 0917 123 4567':c.platform==='email'?'name@example.com':c.platform==='wechat'?'WeChat ID':'URL, username, number or contact detail'}" />
    <input class="contact-custom-label ${c.platform==='custom'?'':'hidden'}" data-contact-label="${i}" value="${esc(c.label||'')}" placeholder="Platform name" />
    <button type="button" class="table-btn danger contact-remove" data-contact-remove="${i}">Remove</button>
  </div>`).join('');
  box.querySelectorAll('[data-contact-platform]').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.contactPlatform); editingContacts[i].platform=el.value; if(el.value!=='custom') editingContacts[i].label=''; renderContactMethodsEditor();}));
  box.querySelectorAll('[data-contact-value]').forEach(el=>el.addEventListener('input',()=>{editingContacts[Number(el.dataset.contactValue)].value=el.value;}));
  box.querySelectorAll('[data-contact-label]').forEach(el=>el.addEventListener('input',()=>{editingContacts[Number(el.dataset.contactLabel)].label=el.value;}));
  box.querySelectorAll('[data-contact-remove]').forEach(el=>el.addEventListener('click',()=>{editingContacts.splice(Number(el.dataset.contactRemove),1); renderContactMethodsEditor();}));
}
function legacyContacts(data){
  const out=[];
  if(data?.facebook_url) out.push({platform:'facebook',label:'',value:data.facebook_url});
  if(data?.messenger_url) out.push({platform:'messenger',label:'',value:data.messenger_url});
  if(data?.contact_number) out.push({platform:'mobile',label:'',value:data.contact_number});
  return out;
}


function adminAssetUrl(supplier, file){
  const value=String(file||'').trim();
  if(!value) return '';
  if(/^https?:\/\//i.test(value)) return value;
  if(value.startsWith('assets/')) return `../${value}`;
  const folder=String(supplier?.asset_folder||'').trim();
  if(!folder) return '';
  return `../assets/suppliers/${folder.replace(/^\/+|\/+$/g,'')}/${value.replace(/^\/+/, '')}`;
}
function publicAssetPath(folder,file){
  const raw=String(file||'').trim().replace(/\\/g,'/');
  if(!raw) return '';
  if(/^https?:\/\//i.test(raw)) return raw;
  if(raw.startsWith('assets/')) return raw.replace(/^\/+/, '');
  const f=String(folder||'').trim().replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
  const n=raw.replace(/^\/+/, '');
  return f&&n ? `assets/suppliers/${f}/${n}` : '';
}
function updateBusinessAssetPreview(){
  const folder=$('businessAssetFolder')?.value.trim()||'';
  const file=$('businessCoverImage')?.value.trim()||'cover.jpg';
  if($('businessAssetPathPreview')) $('businessAssetPathPreview').textContent=publicAssetPath(folder,file)||'assets/suppliers/<business-folder>/cover.jpg';
}
function updateGalleryPathPreview(){
  const supplier=suppliers.find(x=>String(x.id)===String($('gallerySupplier')?.value||''));
  const file=$('galleryImageUrl')?.value.trim()||'';
  const path=supplier&&file ? publicAssetPath(supplier.asset_folder,file) : '';
  if($('galleryPathPreview')) $('galleryPathPreview').textContent=path||'Select a supplier and enter an image filename to preview its GitHub path.';
}

async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

async function writeAudit(action, tableName=null, recordId=null, details={}) {
  try {
    const session = await getSession();
    if (!session?.user?.id) return;
    const payload = {
      user_id: session.user.id,
      action,
      table_name: tableName,
      record_id: recordId == null ? null : String(recordId),
      details: { admin_email: session.user.email || null, ...details }
    };
    const { error } = await db.from('audit_logs').insert(payload);
    if (error) console.warn('Audit log insert failed:', error.message);
  } catch (err) { console.warn('Audit log insert failed:', err); }
}

async function loadAuditLogs() {
  if (!$('auditTableBody')) return;
  const { data, error } = await db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) {
    $('auditTableBody').innerHTML = `<tr><td colspan="6" class="helper">Audit log could not be loaded: ${esc(error.message)}</td></tr>`;
    return;
  }
  auditLogs = data || [];
  refreshAuditFilter();
  renderAuditLogs();
}
function refreshAuditFilter() {
  const el = $('auditActionFilter'); if (!el) return;
  const current = el.value;
  const actions = [...new Set(auditLogs.map(x => x.action).filter(Boolean))].sort();
  el.innerHTML = '<option value="">All actions</option>' + actions.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  el.value = actions.includes(current) ? current : '';
}
function formatAuditDetails(details) {
  if (!details) return '—';
  if (typeof details === 'string') return details;
  const copy = { ...details }; delete copy.admin_email;
  const parts = Object.entries(copy).map(([k,v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return parts.length ? parts.join(' • ') : '—';
}
function renderAuditLogs() {
  const body = $('auditTableBody'); if (!body) return;
  const q = ($('auditSearch')?.value || '').trim().toLowerCase();
  const action = $('auditActionFilter')?.value || '';
  const rows = auditLogs.filter(log => {
    if (action && log.action !== action) return false;
    if (!q) return true;
    const hay = [log.action, log.table_name, log.record_id, log.user_id, log.details?.admin_email, JSON.stringify(log.details || {})].join(' ').toLowerCase();
    return hay.includes(q);
  });
  body.innerHTML = rows.length ? rows.map(log => {
    const dt = log.created_at ? new Date(log.created_at).toLocaleString() : '—';
    const email = log.details?.admin_email || (log.user_id ? String(log.user_id).slice(0,8)+'…' : '—');
    return `<tr><td>${esc(dt)}</td><td>${esc(email)}</td><td><span class="audit-action">${esc(log.action || '—')}</span></td><td>${esc(log.table_name || '—')}</td><td>${esc(log.record_id || '—')}</td><td class="audit-details">${esc(formatAuditDetails(log.details))}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="helper">No matching audit records.</td></tr>';
}

async function checkAdmin() {
  const session = await getSession();
  if (!session) return false;
  const { data, error } = await db.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error) return false;
  return !!data;
}

async function showAuthState() {
  const session = await getSession();
  const isAdmin = session ? await checkAdmin() : false;
  $('adminLogin').classList.toggle('hidden', !!isAdmin);
  $('adminApp').classList.toggle('hidden', !isAdmin);
  if (isAdmin) {
    $('adminEmail').textContent = session.user.email || 'Admin';
    await loadAll();
  } else if (session) {
    $('loginError').textContent = 'This account is signed in but is not registered as an admin.';
  }
}

$('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginError').textContent = '';
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { $('loginError').textContent = error.message; return; }
  if (!(await checkAdmin())) {
    await db.auth.signOut();
    $('loginError').textContent = 'Account is not authorized as an admin.';
    return;
  }
  await writeAudit('LOGIN', 'auth');
  await showAuthState();
});

$('logoutBtn').addEventListener('click', async () => { await writeAudit('LOGOUT', 'auth'); await db.auth.signOut(); await showAuthState(); });

async function loadAll() {
  await Promise.all([loadSuppliers(), loadCategories(), loadServices(), loadReviews(), loadServiceAreas(), loadGallery(), loadAuditLogs(), loadTickets(), loadOwnerSettings()]);
  renderStats();
  refreshSupplierSelects();
}

async function loadSuppliers() {
  const { data, error } = await db.from('suppliers').select(`
    *,
    supplier_categories(category_id, categories(id,name)),
    supplier_services(service_id, services(id,name)),
    supplier_contacts(id,platform,label,value,sort_order,is_active),
    reviews(id,rating,status)
  `).order('created_at', { ascending: false });
  if (error) { toast(`Suppliers load failed: ${error.message}`, 'error'); return; }
  suppliers = (data || []).map(s => ({
    ...s,
    category: s.supplier_categories?.[0]?.categories?.name || '',
    category_id: s.supplier_categories?.[0]?.categories?.id || null,
    services_list: (s.supplier_services || []).map(x => x.services).filter(Boolean),
    contacts_list: (s.supplier_contacts || []).filter(x=>x.is_active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),
    approved_reviews: (s.reviews || []).filter(r => r.status === 'approved')
  }));
  renderSupplierTable();
}

async function loadCategories() {
  const { data, error } = await db.from('categories').select('*').order('name');
  if (error) { toast(`Categories load failed: ${error.message}`, 'error'); return; }
  categories = data || [];
  renderCategoriesTable();
  const dl = $('categoryOptions');
  if (dl) dl.innerHTML = categories.map(c => `<option value="${esc(c.name)}"></option>`).join('');
}

async function loadServices() {
  const { data, error } = await db.from('services').select('*').order('name');
  if (error) { toast(`Services load failed: ${error.message}`, 'error'); return; }
  services = data || [];
  renderServicesTable();
  renderServicePicker();
}

async function loadReviews() {
  const { data, error } = await db.from('reviews').select('*, suppliers(business_name)').order('created_at', { ascending: false });
  if (error) { toast(`Reviews load failed: ${error.message}`, 'error'); return; }
  reviews = data || [];
  renderReviewsTable();
}

async function loadServiceAreas() {
  const { data, error } = await db.from('supplier_service_areas').select('*, suppliers(business_name)').order('province').order('city');
  if (error) { toast(`Service areas load failed: ${error.message}`, 'error'); return; }
  serviceAreas = data || [];
  renderServiceAreasTable();
}

async function loadGallery() {
  const { data, error } = await db.from('supplier_gallery').select('*, suppliers(business_name)').order('sort_order').order('created_at');
  if (error) { toast(`Gallery load failed: ${error.message}`, 'error'); return; }
  gallery = data || [];
  renderGalleryTable();
}

async function loadTickets(){
  if(!$('ticketTableBody')) return;
  const {data,error}=await db.from('contact_tickets').select('*').order('created_at',{ascending:false});
  if(error){ $('ticketTableBody').innerHTML=`<tr><td colspan="7" class="helper">Tickets could not be loaded: ${esc(error.message)}</td></tr>`; return; }
  tickets=data||[]; renderTicketsTable();
}
function ticketTypeLabel(v){return ({update_business:'Update Business',add_business:'Add Business',featured_subscription:'Featured Subscription',supplier_system:'Supplier System Inquiry',other:'Other'})[v]||v||'—';}
function renderTicketsTable(){
  const body=$('ticketTableBody'); if(!body) return; const q=($('ticketSearch')?.value||'').trim().toLowerCase(), st=$('ticketStatusFilter')?.value||'all';
  const rows=tickets.filter(t=>(st==='all'||t.status===st)&&(!q||[t.request_type,t.name,t.business_name,t.email,t.contact_number,t.message].join(' ').toLowerCase().includes(q)));
  body.innerHTML=rows.length?rows.map(t=>`<tr><td>${esc(fmtDateTime(t.created_at))}</td><td>${esc(ticketTypeLabel(t.request_type))}</td><td><strong>${esc(t.name)}</strong><div class="helper">${esc(t.business_name||'')}</div></td><td>${esc(t.email||'—')}<br>${esc(t.contact_number||'')}</td><td class="ticket-message">${esc(t.message||'')}</td><td><select class="ticket-status-select" data-ticket-status="${t.id}"><option value="pending" ${t.status==='pending'?'selected':''}>Pending</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option><option value="resolved" ${t.status==='resolved'?'selected':''}>Resolved</option><option value="closed" ${t.status==='closed'?'selected':''}>Closed</option></select></td><td class="actions"><button class="table-btn danger" onclick="deleteTicket('${t.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="7" class="helper">No tickets match this filter.</td></tr>';
  body.querySelectorAll('[data-ticket-status]').forEach(sel=>sel.addEventListener('change',async()=>{const {error}=await db.from('contact_tickets').update({status:sel.value,updated_at:new Date().toISOString()}).eq('id',sel.dataset.ticketStatus); if(error)return toast(`Ticket update failed: ${error.message}`,'error'); await writeAudit('UPDATE','contact_tickets',sel.dataset.ticketStatus,{status:sel.value}); toast('Ticket status updated successfully.','success'); await loadAll();}));
}
window.deleteTicket=async(id)=>{if(!confirm('Permanently delete this contact ticket?'))return; const {error}=await db.from('contact_tickets').delete().eq('id',id); if(error)return toast(`Ticket delete failed: ${error.message}`,'error'); await writeAudit('DELETE','contact_tickets',id); toast('Ticket deleted successfully.','success'); await loadAll();};
async function loadOwnerSettings(){
  const {data,error}=await db.from('app_settings').select('*').eq('setting_key','owner_messenger_url').maybeSingle();
  if(error){console.warn('Settings load failed:',error.message);return;}
  const raw=data?.setting_value; const value=typeof raw==='string'?raw:(raw?.value||''); if($('ownerMessengerUrl')) $('ownerMessengerUrl').value=value||'';
}
function refreshSupplierSelects() {
  const options = `<option value="">Select supplier</option>` + suppliers.map(s => `<option value="${s.id}">${esc(s.business_name)}</option>`).join('');
  if ($('serviceAreaSupplier')) $('serviceAreaSupplier').innerHTML = options;
  if ($('gallerySupplier')) $('gallerySupplier').innerHTML = options;
}

function renderStats() {
  const states=suppliers.map(featuredState);
  $('statSuppliers').textContent = suppliers.length;
  $('statFeatured').textContent = states.filter(x=>x.active).length;
  $('statFeaturedSoon').textContent = suppliers.filter(s=>{const x=featuredState(s); return x.active&&x.until&&(x.until-Date.now())<=24*60*60*1000;}).length;
  $('statFeaturedExpired').textContent = states.filter(x=>x.expired).length;
  $('statCategories').textContent = categories.length;
  $('statReviews').textContent = reviews.length;
  $('statPending').textContent = reviews.filter(r => r.status === 'pending').length;
  $('statTickets').textContent = tickets.filter(t=>['pending','in_progress'].includes(t.status)).length;
  renderFeaturedDashboard();
}
function renderFeaturedDashboard(){
  const body=$('featuredDashboardBody'); if(!body) return;
  const rows=suppliers.filter(s=>(s.featured_plan&&s.featured_plan!=='none')||s.is_featured).sort((a,b)=>new Date(b.featured_started_at||0)-new Date(a.featured_started_at||0));
  body.innerHTML=rows.length?rows.map(s=>{const f=featuredState(s);return `<tr><td><strong>${esc(s.business_name)}</strong></td><td>${esc(planLabel(s.featured_plan))}</td><td>${esc(fmtDateTime(s.featured_started_at))}</td><td>${s.featured_plan==='lifetime'?'No expiration':esc(fmtDateTime(s.featured_until))}</td><td><span class="status-pill ${f.active?'success':f.expired?'danger':'neutral'}">${esc(f.label)}</span></td></tr>`}).join(''):'<tr><td colspan="5" class="helper">No featured subscription history yet.</td></tr>';
}

function avgRating(s) {
  const rs = s.approved_reviews || [];
  return rs.length ? rs.reduce((a,r)=>a+Number(r.rating||0),0)/rs.length : 0;
}
function featuredState(s){
  const plan=s.featured_plan||'none';
  const start=s.featured_started_at?new Date(s.featured_started_at):null;
  const until=s.featured_until?new Date(s.featured_until):null;
  const now=new Date();
  if(plan==='lifetime' && s.is_featured) return {active:true,expired:false,label:'Featured Lifetime',plan:'lifetime',start,until:null};
  if(plan!=='none' && until){
    const active=until.getTime()>now.getTime() && !!s.is_featured;
    return {active,expired:!active,label:active?'Featured Active':'Featured Expired',plan,start,until};
  }
  return {active:false,expired:false,label:'Not Featured',plan:'none',start,until:null};
}
function fmtDateTime(v){ if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleString(); }
function planLabel(plan){ return ({'1_day':'1 Day','3_days':'3 Days','7_days':'7 Days','lifetime':'Lifetime','none':'Not Featured'})[plan||'none']||plan; }
function calculateFeaturedFields(plan, existing=null){
  const now=new Date();
  if(plan==='none') return {is_featured:false,featured_plan:'none',featured_started_at:null,featured_until:null};
  if(plan==='lifetime') return {is_featured:true,featured_plan:'lifetime',featured_started_at:existing?.featured_started_at||now.toISOString(),featured_until:null};
  const days=plan==='1_day'?1:plan==='3_days'?3:7;
  const keepExisting=existing?.featured_plan===plan && existing?.is_featured && existing?.featured_until && new Date(existing.featured_until)>now;
  const start=keepExisting&&existing.featured_started_at?new Date(existing.featured_started_at):now;
  const until=keepExisting?new Date(existing.featured_until):new Date(start.getTime()+days*24*60*60*1000);
  return {is_featured:true,featured_plan:plan,featured_started_at:start.toISOString(),featured_until:until.toISOString()};
}
function renderFeaturedPlanPreview(){
  const plan=$('businessFeaturedPlan')?.value||'none'; const el=$('featuredPlanPreview'); if(!el) return;
  if(plan==='none'){el.textContent='Not featured.';return;} if(plan==='lifetime'){el.textContent='Lifetime featured — no expiration.';return;}
  const days=plan==='1_day'?1:plan==='3_days'?3:7; const end=new Date(Date.now()+days*86400000); el.textContent=`Starts when saved • Estimated end: ${end.toLocaleString()}`;
}

function renderSupplierTable() {
  const q=($('supplierAdminSearch')?.value||'').trim().toLowerCase();
  const filter=$('supplierStatusFilter')?.value||'all';
  let rows=suppliers.filter(s=>!q||[s.business_name,s.category,s.city,s.province,...(s.services_list||[]).map(x=>x.name)].join(' ').toLowerCase().includes(q));
  rows=rows.filter(s=>{
    const f=featuredState(s);
    if(filter==='all') return true;
    if(filter==='active') return !!s.is_active;
    if(filter==='inactive') return !s.is_active;
    if(filter==='verified') return !!s.is_verified;
    if(filter==='not-verified') return !s.is_verified;
    return true;
  });
  $('supplierTableBody').innerHTML = rows.length ? rows.map(s => {const f=featuredState(s); return `<tr>
    <td><strong>${esc(s.business_name)}</strong><div class="mini-tags">${(s.services_list||[]).slice(0,3).map(x=>`<span>${esc(x.name)}</span>`).join('')}</div></td>
    <td>${esc(s.category || '—')}</td>
    <td>${esc([s.city,s.province].filter(Boolean).join(', ') || '—')}</td>
    <td>★ ${avgRating(s).toFixed(1)}</td>
    <td>${esc(planLabel(s.featured_plan))}</td>
    <td>${esc(fmtDateTime(s.featured_started_at))}</td>
    <td>${s.featured_plan==='lifetime'?'No expiration':esc(fmtDateTime(s.featured_until))}</td>
    <td><span class="status-pill ${s.is_active?'success':'danger'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
    <td><span class="status-pill ${s.is_verified?'success':'neutral'}">${s.is_verified ? 'Verified' : 'Not Verified'}</span></td>
    <td class="actions"><button class="table-btn" onclick="editSupplier('${s.id}')">Edit</button><button class="table-btn danger" onclick="deleteSupplier('${s.id}')">Delete</button></td>
  </tr>`}).join('') : '<tr><td colspan="10" class="helper">No suppliers match this filter.</td></tr>';
}

function renderCategoriesTable() {
  $('categoryTableBody').innerHTML = categories.length ? categories.map(c => `<tr><td>${esc(c.name)}</td><td>${c.is_active?'Active':'Inactive'}</td><td class="actions"><button class="table-btn danger" onclick="deleteCategory('${c.id}')">Delete</button></td></tr>`).join('') : '<tr><td colspan="3" class="helper">No categories.</td></tr>';
}

function renderServicesTable() {
  $('serviceTableBody').innerHTML = services.length ? services.map(s => `<tr><td>${esc(s.name)}</td><td>${s.is_active?'Active':'Inactive'}</td><td class="actions"><button class="table-btn danger" onclick="deleteService('${s.id}')">Delete</button></td></tr>`).join('') : '<tr><td colspan="3" class="helper">No services.</td></tr>';
}

function renderReviewsTable() {
  $('reviewTableBody').innerHTML = reviews.length ? reviews.map(r => `<tr>
    <td>${esc(r.suppliers?.business_name || '—')}</td><td>${esc(r.reviewer_name)}</td><td>★ ${r.rating}</td><td>${esc(r.message || '')}</td><td>${esc(r.status)}</td>
    <td class="actions"><button class="table-btn" onclick="setReviewStatus('${r.id}','approved')">Approve</button><button class="table-btn" onclick="setReviewStatus('${r.id}','hidden')">Hide</button><button class="table-btn danger" onclick="deleteReview('${r.id}')">Delete</button></td>
  </tr>`).join('') : '<tr><td colspan="6" class="helper">No reviews.</td></tr>';
}

function renderServiceAreasTable() {
  if (!$('serviceAreaTableBody')) return;
  $('serviceAreaTableBody').innerHTML = serviceAreas.length ? serviceAreas.map(a => `<tr>
    <td>${esc(a.suppliers?.business_name || '—')}</td><td>${esc(a.province || '—')}</td><td>${esc(a.city || 'All cities')}</td>
    <td class="actions"><button class="table-btn danger" onclick="deleteServiceArea('${a.id}')">Delete</button></td>
  </tr>`).join('') : '<tr><td colspan="4" class="helper">No service areas yet.</td></tr>';
}

function renderGalleryTable() {
  if (!$('galleryTableBody')) return;
  const selectedSupplierId = String($('gallerySupplier')?.value || '');

  if (!selectedSupplierId) {
    $('galleryTableBody').innerHTML = '<tr><td colspan="5" class="helper">Select a supplier to view its gallery images.</td></tr>';
    return;
  }

  const rows = gallery.filter(g => String(g.supplier_id) === selectedSupplierId);
  $('galleryTableBody').innerHTML = rows.length ? rows.map(g => {
    const supplier = suppliers.find(s => String(s.id) === String(g.supplier_id));
    const publicPath = publicAssetPath(supplier?.asset_folder, g.image_url);
    const src = publicPath ? `../${publicPath}` : adminAssetUrl(supplier, g.image_url);
    return `<tr>
    <td>${src?`<img class="gallery-thumb" src="${esc(src)}" alt="Gallery preview" onerror="this.style.display='none'" />`:'—'}</td>
    <td>${esc(supplier?.business_name || g.suppliers?.business_name || '—')}</td><td class="url-cell" title="${esc(publicPath||g.image_url)}">${esc(publicPath||g.image_url)}</td><td>${Number(g.sort_order||0)}</td>
    <td class="actions"><button class="table-btn danger" onclick="deleteGalleryImage('${g.id}')">Delete</button></td>
  </tr>`}).join('') : '<tr><td colspan="5" class="helper">No gallery images for this supplier yet.</td></tr>';
}

function renderServicePicker(filter='') {
  const box = $('serviceOptions');
  if (!box) return;
  const q = filter.trim().toLowerCase();
  const filtered = services.filter(s => s.is_active !== false && (!q || s.name.toLowerCase().includes(q)));
  box.innerHTML = filtered.length ? filtered.map(s => `<label class="service-option">
      <input type="checkbox" value="${s.id}" ${selectedServiceIds.has(s.id) ? 'checked' : ''} />
      <span>${esc(s.name)}</span>
    </label>`).join('') : '<div class="service-option-empty">No matching tags.</div>';
  box.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
    if (input.checked) selectedServiceIds.add(input.value); else selectedServiceIds.delete(input.value);
    renderSelectedServiceChips();
  }));
}

function renderSelectedServiceChips() {
  const wrap = $('selectedServiceChips');
  if (!wrap) return;
  const picked = services.filter(s => selectedServiceIds.has(s.id));
  wrap.innerHTML = picked.length ? picked.map(s => `<button type="button" class="selected-service-chip" data-id="${s.id}" title="Remove ${esc(s.name)}">${esc(s.name)} <span>×</span></button>`).join('') : '<span class="helper">No tags selected.</span>';
  wrap.querySelectorAll('.selected-service-chip').forEach(btn => btn.addEventListener('click', () => {
    selectedServiceIds.delete(btn.dataset.id);
    renderSelectedServiceChips();
    renderServicePicker($('serviceSearchInput').value);
  }));
}

$('serviceSearchInput')?.addEventListener('input', e => renderServicePicker(e.target.value));
$('businessFeaturedPlan')?.addEventListener('change',renderFeaturedPlanPreview);
$('supplierAdminSearch')?.addEventListener('input',renderSupplierTable);
$('supplierStatusFilter')?.addEventListener('change',renderSupplierTable);

function ensureMap() {
  if (supplierMap || !window.L) return;
  supplierMap = L.map('supplierMap', { zoomControl: true }).setView([12.8797, 121.7740], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(supplierMap);
  supplierMap.on('click', (e) => setMapPoint(e.latlng.lat, e.latlng.lng, true));
}

function setMapPoint(lat, lng, move=true) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  $('businessLat').value = lat.toFixed(7);
  $('businessLng').value = lng.toFixed(7);
  ensureMap();
  if (!supplierMarker) {
    supplierMarker = L.marker([lat, lng], { draggable: true }).addTo(supplierMap);
    supplierMarker.on('dragend', () => {
      const p = supplierMarker.getLatLng();
      $('businessLat').value = p.lat.toFixed(7);
      $('businessLng').value = p.lng.toFixed(7);
    });
  } else supplierMarker.setLatLng([lat, lng]);
  if (move) supplierMap.setView([lat, lng], 16);
}

async function geocodeTypedAddress() {
  const parts = [$('businessAddress').value, $('businessCity').value, $('businessProvince').value, 'Philippines'].filter(Boolean);
  if (parts.length <= 1) return toast('Enter an address, city, or province first.', 'warning');
  const btn = $('findAddressBtn');
  btn.disabled = true; btn.textContent = 'Searching…';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(parts.join(', '))}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Map search returned ${res.status}`);
    const rows = await res.json();
    if (!rows.length) return toast('Address was not found. Try a more complete address or click the map manually.', 'warning');
    setMapPoint(Number(rows[0].lat), Number(rows[0].lon), true);
    toast('Map pin placed from the address.', 'success');
  } catch (err) {
    toast(`Map search failed: ${err.message || err}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Find Address';
  }
}

$('findAddressBtn')?.addEventListener('click', geocodeTypedAddress);
$('useAdminLocationBtn')?.addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocation is not supported by this browser.', 'error');
  toast('Requesting your current location…', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => { setMapPoint(pos.coords.latitude, pos.coords.longitude, true); toast('Current location pinned on the map.', 'success'); },
    err => toast(`Could not get your location: ${err.message}`, 'error'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function openModal(data=null) {
  $('supplierModal').classList.remove('hidden');
  $('modalTitle').textContent = data ? 'Edit Supplier' : 'Add Supplier';
  $('supplierId').value = data?.id || '';
  $('businessName').value = data?.business_name || '';
  $('businessCategory').value = data?.category || '';
  $('businessAddress').value = data?.address || '';
  $('businessCity').value = data?.city || '';
  $('businessProvince').value = data?.province || '';
  editingContacts = (data?.contacts_list?.length ? data.contacts_list.map(x=>({platform:x.platform||'custom',label:x.label||'',value:x.value||''})) : legacyContacts(data));
  if (!editingContacts.length) editingContacts = [blankContact()];
  renderContactMethodsEditor();
  $('businessAssetFolder').value = data?.asset_folder || (data?.business_name ? slugify(data.business_name) : '');
  $('businessCoverImage').value = data?.cover_image || 'cover.jpg';
  $('businessLogoImage').value = data?.logo_image || 'logo.png';
  updateBusinessAssetPreview();
  $('businessLat').value = data?.latitude ?? '';
  $('businessLng').value = data?.longitude ?? '';
  $('businessDescription').value = data?.description || '';
  $('businessFeaturedPlan').value = data?.featured_plan || (data?.is_featured ? 'lifetime' : 'none');
  renderFeaturedPlanPreview();
  $('businessVerified').checked = !!data?.is_verified;
  $('businessActive').checked = data ? !!data.is_active : true;
  selectedServiceIds = new Set((data?.services_list || []).map(x => x.id));
  $('serviceSearchInput').value = '';
  renderSelectedServiceChips();
  renderServicePicker();
  setTimeout(() => {
    ensureMap();
    supplierMap?.invalidateSize();
    if (data?.latitude != null && data?.longitude != null) setMapPoint(data.latitude, data.longitude, true);
    else {
      if (supplierMarker) { supplierMap.removeLayer(supplierMarker); supplierMarker = null; }
      supplierMap?.setView([12.8797, 121.7740], 5);
    }
  }, 80);
}

function closeModal(){
  $('supplierModal').classList.add('hidden');
  $('supplierForm').reset();
  if ($('businessCoverImage')) $('businessCoverImage').value='cover.jpg';
  if ($('businessLogoImage')) $('businessLogoImage').value='logo.png';
  updateBusinessAssetPreview();
  selectedServiceIds.clear();
  editingContacts = [];
  renderContactMethodsEditor();
  renderSelectedServiceChips();
  renderServicePicker();
}
window.editSupplier = (id) => openModal(suppliers.find(s => s.id === id));

async function ensureCategory(name) {
  const clean = name.trim();
  if (!clean) return null;
  let found = categories.find(c => c.name.toLowerCase() === clean.toLowerCase());
  if (found) return found;
  const { data, error } = await db.from('categories').insert({ name: clean, slug: slugify(clean), is_active: true }).select().single();
  if (error) throw error;
  categories.push(data); return data;
}

$('generateAssetFolderBtn')?.addEventListener('click',()=>{
  const folder=slugify($('businessName').value);
  if(!folder) return toast('Enter the Business Name first.', 'warning');
  $('businessAssetFolder').value=folder; updateBusinessAssetPreview();
});
$('businessAssetFolder')?.addEventListener('input',updateBusinessAssetPreview);
$('businessCoverImage')?.addEventListener('input',updateBusinessAssetPreview);
$('businessName')?.addEventListener('input',()=>{
  if(!$('supplierId').value && !$('businessAssetFolder').value.trim()){
    $('businessAssetFolder').value=slugify($('businessName').value); updateBusinessAssetPreview();
  }
});
$('gallerySupplier')?.addEventListener('change',()=>{
  updateGalleryPathPreview();
  renderGalleryTable();
});
$('galleryImageUrl')?.addEventListener('input',updateGalleryPathPreview);

$('addContactMethodBtn')?.addEventListener('click',()=>{ editingContacts.push(blankContact()); renderContactMethodsEditor(); });
$('addSupplierBtn').addEventListener('click', () => openModal());
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelSupplierBtn').addEventListener('click', closeModal);

$('supplierForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = e.submitter;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  try {
    const id = $('supplierId').value || null;
    const isEditing = !!id;
    const supplierData = {
      business_name: $('businessName').value.trim(),
      description: $('businessDescription').value.trim() || null,
      address: $('businessAddress').value.trim() || null,
      city: $('businessCity').value.trim() || null,
      province: $('businessProvince').value.trim() || null,
      latitude: $('businessLat').value ? Number($('businessLat').value) : null,
      longitude: $('businessLng').value ? Number($('businessLng').value) : null,
      contact_number: null,
      facebook_url: null,
      messenger_url: null,
      asset_folder: $('businessAssetFolder').value.trim() || slugify($('businessName').value),
      cover_image: $('businessCoverImage').value.trim() || 'cover.jpg',
      logo_image: $('businessLogoImage').value.trim() || 'logo.png',
      ...calculateFeaturedFields($('businessFeaturedPlan').value, suppliers.find(x=>String(x.id)===String(id))),
      is_verified: $('businessVerified').checked,
      is_active: $('businessActive').checked,
      updated_at: new Date().toISOString()
    };
    let supplierId = id;
    if (id) {
      const { error } = await db.from('suppliers').update(supplierData).eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('suppliers').insert(supplierData).select('id').single();
      if (error) throw error;
      supplierId = data.id;
    }

    const category = await ensureCategory($('businessCategory').value);
    const { error: categoryDeleteError } = await db.from('supplier_categories').delete().eq('supplier_id', supplierId);
    if (categoryDeleteError) throw categoryDeleteError;
    if (category) {
      const { error } = await db.from('supplier_categories').insert({ supplier_id: supplierId, category_id: category.id });
      if (error) throw error;
    }

    const { error: serviceDeleteError } = await db.from('supplier_services').delete().eq('supplier_id', supplierId);
    if (serviceDeleteError) throw serviceDeleteError;
    if (selectedServiceIds.size) {
      const rows = [...selectedServiceIds].map(service_id => ({ supplier_id: supplierId, service_id }));
      const { error } = await db.from('supplier_services').insert(rows);
      if (error) throw error;
    }

    const cleanedContacts = editingContacts.map((c,i)=>({
      supplier_id: supplierId, platform: c.platform || 'custom', label: c.platform==='custom' ? (c.label||'Other').trim() : null,
      value: (c.value||'').trim(), sort_order: i+1, is_active: true
    })).filter(c=>c.value);
    const { error: contactDeleteError } = await db.from('supplier_contacts').delete().eq('supplier_id', supplierId);
    if (contactDeleteError) throw contactDeleteError;
    if (cleanedContacts.length) {
      const { error: contactInsertError } = await db.from('supplier_contacts').insert(cleanedContacts);
      if (contactInsertError) throw contactInsertError;
    }

    await writeAudit(isEditing ? 'UPDATE' : 'ADD', 'suppliers', supplierId, { business_name: supplierData.business_name });
    toast(isEditing ? 'Supplier updated successfully.' : 'Supplier added successfully.', 'success');
    closeModal();
    await loadAll();
  } catch (err) {
    console.error(err);
    toast(`Save failed: ${err.message || err}`, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Supplier'; }
  }
});

window.deleteSupplier = async (id) => {
  const s = suppliers.find(x => x.id === id);
  if (!confirm(`Permanently delete ${s?.business_name || 'this supplier'} and its related reviews/gallery/services?`)) return;
  const { error } = await db.from('suppliers').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  await writeAudit('DELETE', 'suppliers', id, { business_name: s?.business_name || null });
  toast('Supplier deleted successfully.', 'success'); await loadAll();
};
window.deleteCategory = async (id) => {
  if (!confirm('Permanently delete this category? Supplier links to it will also be removed.')) return;
  const { error } = await db.from('categories').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  const c = categories.find(x => x.id === id); await writeAudit('DELETE', 'categories', id, { name: c?.name || null });
  toast('Category deleted successfully.', 'success'); await loadAll();
};
window.deleteService = async (id) => {
  if (!confirm('Permanently delete this service/tag? Supplier links to it will also be removed.')) return;
  const { error } = await db.from('services').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  selectedServiceIds.delete(id);
  const svc = services.find(x => x.id === id); await writeAudit('DELETE', 'services', id, { name: svc?.name || null });
  toast('Service deleted successfully.', 'success'); await loadAll();
};
window.deleteReview = async (id) => {
  if (!confirm('Permanently delete this review?')) return;
  const { error } = await db.from('reviews').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  await writeAudit('DELETE', 'reviews', id);
  toast('Review deleted successfully.', 'success'); await loadAll();
};
window.setReviewStatus = async (id, status) => {
  const { error } = await db.from('reviews').update({ status }).eq('id', id);
  if (error) return toast(`Update failed: ${error.message}`, 'error');
  await writeAudit('UPDATE', 'reviews', id, { status });
  toast(`Review updated successfully (${status}).`, 'success'); await loadAll();
};
window.deleteServiceArea = async (id) => {
  if (!confirm('Permanently delete this service area?')) return;
  const { error } = await db.from('supplier_service_areas').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  await writeAudit('DELETE', 'supplier_service_areas', id);
  toast('Service area deleted successfully.', 'success'); await loadAll();
};
window.deleteGalleryImage = async (id) => {
  if (!confirm('Permanently delete this gallery image record?')) return;
  const { error } = await db.from('supplier_gallery').delete().eq('id', id);
  if (error) return toast(`Delete failed: ${error.message}`, 'error');
  await writeAudit('DELETE', 'supplier_gallery', id);
  toast('Gallery image deleted successfully.', 'success'); await loadAll();
};

$('addCategoryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('newCategoryName').value.trim(); if (!name) return;
  const { error } = await db.from('categories').insert({ name, slug: slugify(name), is_active:true });
  if (error) return toast(`Category save failed: ${error.message}`, 'error');
  $('newCategoryName').value=''; await writeAudit('ADD', 'categories', null, { name }); toast('Category added successfully.', 'success'); await loadAll();
});
$('addServiceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('newServiceName').value.trim(); if (!name) return;
  const { error } = await db.from('services').insert({ name, is_active:true });
  if (error) return toast(`Service save failed: ${error.message}`, 'error');
  $('newServiceName').value=''; await writeAudit('ADD', 'services', null, { name }); toast('Service added successfully.', 'success'); await loadAll();
});
$('addServiceAreaForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    supplier_id: $('serviceAreaSupplier').value,
    province: $('serviceAreaProvince').value.trim() || null,
    city: $('serviceAreaCity').value.trim() || null
  };
  const { error } = await db.from('supplier_service_areas').insert(payload);
  if (error) return toast(`Service area save failed: ${error.message}`, 'error');
  e.target.reset(); await writeAudit('ADD', 'supplier_service_areas', null, payload); toast('Service area added successfully.', 'success'); await loadAll();
});
$('addGalleryForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const supplier=suppliers.find(x=>String(x.id)===String($('gallerySupplier').value));
  if (!supplier?.asset_folder) return toast('This supplier has no Business Asset Folder yet. Edit the supplier first.', 'error');
  const payload = {
    supplier_id: $('gallerySupplier').value,
    image_url: $('galleryImageUrl').value.trim(),
    sort_order: Number($('gallerySortOrder').value || 0)
  };
  if (!payload.image_url) return toast('Enter the image filename first.', 'error');
  const { error } = await db.from('supplier_gallery').insert(payload);
  if (error) return toast(`Gallery save failed: ${error.message}`, 'error');
  e.target.reset(); $('gallerySortOrder').value = '0'; updateGalleryPathPreview(); await writeAudit('ADD', 'supplier_gallery', null, { supplier_id: payload.supplier_id, image_url: payload.image_url }); toast('Gallery image added successfully.', 'success'); await loadAll();
});

$('refreshAuditBtn')?.addEventListener('click', async () => { await loadAuditLogs(); toast('Audit log refreshed.', 'success'); });
$('auditSearch')?.addEventListener('input', renderAuditLogs);
$('auditActionFilter')?.addEventListener('change', renderAuditLogs);
$('refreshTicketsBtn')?.addEventListener('click',async()=>{await loadTickets();toast('Tickets refreshed.','success');});
$('ticketSearch')?.addEventListener('input',renderTicketsTable);
$('ticketStatusFilter')?.addEventListener('change',renderTicketsTable);
$('ownerSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();const value=$('ownerMessengerUrl').value.trim();const payload={setting_key:'owner_messenger_url',setting_value:{value},updated_at:new Date().toISOString()};const {error}=await db.from('app_settings').upsert(payload,{onConflict:'setting_key'});if(error)return toast(`Settings save failed: ${error.message}`,'error');await writeAudit('UPDATE','app_settings','owner_messenger_url',{value});toast('Owner Messenger setting updated successfully.','success');});

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('.admin-view').forEach(x=>x.classList.remove('active-view')); $('view-'+btn.dataset.view).classList.add('active-view');
}));

db.auth.onAuthStateChange(() => setTimeout(showAuthState, 0));
showAuthState();
