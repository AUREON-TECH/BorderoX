const SUPABASE_URL='https://veznreiamwstlulkpocz.supabase.co';
const SUPABASE_KEY='sb_publishable_7ukoyUiZh73XRZxzBDhqjw_OsvJ8_JB';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const authView=$('authView'),appView=$('appView'),authForm=$('authForm'),authStatus=$('authStatus');
let authMode='login',currentUser=null,demoMode=false,currentFile=null,extractedText='',lastCalc=null;
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const money=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=id=>Number($(id).value)||0;
const roleName=v=>({promotor:'Promotor de Marketing',consultor:'Consultor',closer:'Closer'}[v]||'Perfil');
const parseBR=s=>{if(!s)return 0;const clean=String(s).replace(/R\$\s?/gi,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');return Number(clean)||0};

function setMode(mode){
 authMode=mode;
 $('tabLogin').classList.toggle('active',mode==='login');
 $('tabSignup').classList.toggle('active',mode==='signup');
 $('nameWrap').classList.toggle('hidden',mode==='login');
 $('authSubmit').textContent=mode==='login'?'Entrar':'Criar minha conta';
 $('forgotBtn').classList.toggle('hidden',mode==='signup');
 authStatus.textContent='';
}
$('tabLogin').onclick=()=>setMode('login');
$('tabSignup').onclick=()=>setMode('signup');

authForm.addEventListener('submit',async e=>{
 e.preventDefault(); authStatus.textContent=authMode==='login'?'Entrando…':'Criando conta…';
 const email=$('email').value.trim(),password=$('password').value,fullName=$('fullName').value.trim();
 try{
   if(authMode==='signup'){
     const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:fullName}}});
     if(error) throw error;
     if(!data.session){authStatus.textContent='Conta criada. Confira seu e-mail para confirmar o cadastro.';return}
   }else{
     const {error}=await db.auth.signInWithPassword({email,password});
     if(error) throw error;
   }
 }catch(err){
   const msg=String(err?.message||'').toLowerCase();
   if(msg.includes('email rate limit exceeded')||msg.includes('rate limit')){
     authStatus.textContent='Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.';
   }else if(msg.includes('user already registered')){
     authStatus.textContent='Este e-mail já possui conta. Toque em Entrar.';
   }else{
     authStatus.textContent=err.message||'Não foi possível continuar.';
   }
 }
});

$('forgotBtn').onclick=async()=>{
 const email=$('email').value.trim();
 if(!email){authStatus.textContent='Digite seu e-mail primeiro.';return}
 authStatus.textContent='Enviando recuperação…';
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 if(error){
   const msg=String(error.message||'').toLowerCase();
   authStatus.textContent=(msg.includes('rate limit')?'Muitas solicitações em pouco tempo. Aguarde alguns minutos antes de pedir outro e-mail.':error.message);
 }else authStatus.textContent='Enviamos o link de recuperação para seu e-mail.';
};

$('demoBtn').onclick=()=>enterApp({id:'demo',email:'demo@borderox.app',user_metadata:{full_name:'Demonstração'}},true);
$('logoutBtn').onclick=async()=>{if(!demoMode)await db.auth.signOut();demoMode=false;currentUser=null;appView.classList.add('hidden');authView.classList.remove('hidden')};

db.auth.onAuthStateChange((_event,session)=>{if(session?.user)enterApp(session.user,false);else if(!demoMode){appView.classList.add('hidden');authView.classList.remove('hidden')}});
db.auth.getSession().then(({data})=>{if(data.session?.user)enterApp(data.session.user,false)});

async function enterApp(user,isDemo){
 currentUser=user; demoMode=isDemo;
 authView.classList.add('hidden');appView.classList.remove('hidden');
 $('userName').textContent=user.user_metadata?.full_name||user.email?.split('@')[0]||'Profissional';
 const now=new Date();
 if($('competenceMonth'))$('competenceMonth').value=String(now.getMonth()+1);
 if($('competenceYear'))$('competenceYear').value=String(now.getFullYear());
 if($('historyYear'))$('historyYear').value=String(now.getFullYear());
 if(isDemo){loadDemoProfile();renderHistory([]);return}
 await loadProfile(); await loadHistory();
}

function loadDemoProfile(){
 $('role').value='promotor';$('commissionPercent').value='1';$('commissionBase').value='vgv';
 $('fixedPay').value='1500';$('spiff').value='0';$('minimumGuarantee').value='1500';$('commissionAdvance').value='0';$('otherBonus').value='0';$('otherDeductions').value='0';
 syncRole();
}

async function loadProfile(){
 const {data}=await db.from('borderox_profiles').select('*').eq('user_id',currentUser.id).maybeSingle();
 if(!data){syncRole();return}
 $('role').value=data.professional_role||'';
 $('commissionPercent').value=data.commission_percent||0;
 $('commissionBase').value=data.commission_base||'vgv';
 $('fixedPay').value=data.fixed_pay||0;$('spiff').value=data.spiff||0;
 $('minimumGuarantee').value=data.minimum_guarantee||0;$('commissionAdvance').value=data.commission_advance||0;
 $('otherBonus').value=data.other_bonus||0;$('otherDeductions').value=data.other_deductions||0;
 syncRole();
}

$('role').onchange=syncRole;
function syncRole(){$('roleBadge').textContent=roleName($('role').value)}
$('saveProfileBtn').onclick=saveProfile;

async function saveProfile(){
 syncRole();$('savedBadge').textContent='salvando…';
 if(demoMode){$('savedBadge').textContent='demo';return}
 const payload={
   user_id:currentUser.id,full_name:currentUser.user_metadata?.full_name||null,email:currentUser.email,
   professional_role:$('role').value||null,commission_percent:num('commissionPercent'),commission_base:$('commissionBase').value,
   fixed_pay:num('fixedPay'),spiff:num('spiff'),minimum_guarantee:num('minimumGuarantee'),
   commission_advance:num('commissionAdvance'),other_bonus:num('otherBonus'),other_deductions:num('otherDeductions'),updated_at:new Date().toISOString()
 };
 const {error}=await db.from('borderox_profiles').upsert(payload,{onConflict:'user_id'});
 $('savedBadge').textContent=error?'erro':'salvo';
 if(error) $('fileStatus').textContent='Não foi possível salvar o perfil: '+error.message;
}

$('fileInput').addEventListener('change',async e=>{
 const file=e.target.files?.[0]; if(!file)return;
 currentFile=file;$('fileStatus').textContent='Lendo '+file.name+'…';$('reviewBox').classList.add('hidden');
 try{
   const parsed=await readStatement(file);extractedText=parsed.text||'';
   $('detectedVgv').value=parsed.vgv.toFixed(2);$('detectedReleased').value=parsed.released.toFixed(2);
   $('detectedTotal').value=parsed.total.toFixed(2);$('detectedSales').value=parsed.sales;$('periodLabel').value=parsed.period||'';
   if(parsed.period){const m=parsed.period.match(/\/([01]?\d)\/(\d{4})/);if(m){$('competenceMonth').value=String(Number(m[1]));$('competenceYear').value=m[2]}}
   $('reviewBox').classList.remove('hidden');
   $('fileStatus').textContent='Leitura concluída. Confira os valores antes de calcular.';
 }catch(err){$('fileStatus').textContent='Não consegui ler automaticamente: '+(err.message||err)}
});

async function readStatement(file){
 const ext=file.name.split('.').pop().toLowerCase();
 let text='',tokens=[];
 if(ext==='pdf'){
   const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
   const bytes=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjs.getDocument({data:bytes}).promise;
   for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const c=await page.getTextContent();const t=c.items.map(i=>i.str).filter(Boolean);tokens.push(...t);text+='\n'+t.join(' ')}
 }else if(['xlsx','xls'].includes(ext)){
   if(!window.XLSX)throw new Error('Leitor de planilha ainda carregando. Tente novamente em alguns segundos.');
   const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});for(const s of wb.SheetNames){const csv=XLSX.utils.sheet_to_csv(wb.Sheets[s]);text+='\n'+csv}tokens=text.split(/[\n,;]/).filter(Boolean);
 }else{text=await file.text();tokens=text.split(/\s+/).filter(Boolean)}
 return extractNumbers(text,tokens);
}

function extractNumbers(text,tokens){
 const flat=text.replace(/\s+/g,' ');
 const totalMatch=flat.match(/TOTAL\s*:?\s*(R\$\s*[\d.]+,\d{2})/i);
 const periodMatch=flat.match(/PER[IÍ]ODO\s*:?\s*([0-3]?\d\/[01]?\d\/\d{4}\s*(?:a|até|-)\s*[0-3]?\d\/[01]?\d\/\d{4})/i);
 const total=totalMatch?parseBR(totalMatch[1]):0;
 let released=0,sales=0,vgv=0;const seen=new Set();
 for(let i=0;i<tokens.length;i++){
   const tok=String(tokens[i]).trim();
   if(/^Liberada$/i.test(tok)){
     for(let j=i-1;j>=Math.max(0,i-10);j--){if(/R\$\s*[\d.]+,\d{2}/.test(tokens[j])){released+=parseBR(tokens[j]);break}}
   }
   if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(tok)){
     const window=tokens.slice(i,i+12).map(String);
     const contract=window.find(x=>/\d{1,2}\s*\/\s*\d{1,2}/.test(x)&&!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x));
     const firstMoney=window.find(x=>/R\$\s*[\d.]+,\d{2}/.test(x));
     if(contract&&!seen.has(contract)){seen.add(contract);sales++;if(firstMoney)vgv+=parseBR(firstMoney)}
   }
 }
 if(!sales){
   const contracts=[...flat.matchAll(/(?:COLLINA\s*-?\s*)?\d{1,2}\s*\/\s*\d{1,2}/gi)].map(m=>m[0]);
   sales=new Set(contracts).size;
 }
 return {text,total,period:periodMatch?.[1]||'',released,vgv,sales};
}

$('calculateBtn').onclick=calculate;
async function calculate(){
 const role=$('role').value;if(!role){$('fileStatus').textContent='Escolha sua profissão antes de calcular.';return}
 const vgv=num('detectedVgv'),released=num('detectedReleased'),detectedTotal=num('detectedTotal'),sales=Math.max(0,Math.round(num('detectedSales')));
 const pct=num('commissionPercent'),base=$('commissionBase').value==='liberado'?released:vgv;
 const rawCommission=base*(pct/100),minimum=num('minimumGuarantee');
 const commissionAfterMinimum=Math.max(rawCommission,minimum);
 const minimumComplement=Math.max(0,minimum-rawCommission);
 const fixed=num('fixedPay'),spiff=num('spiff'),bonus=num('otherBonus'),advance=num('commissionAdvance'),deductions=num('otherDeductions');
 const companyDebt=num('companyDebt'),companyDebtReason=$('companyDebtReason').value.trim();
 const competenceMonth=Number($('competenceMonth').value)||new Date().getMonth()+1,competenceYear=Number($('competenceYear').value)||new Date().getFullYear();
 const cashReleaseThreshold=2;
 const net=commissionAfterMinimum+fixed+spiff+bonus-advance-deductions-companyDebt;
 lastCalc={vgv,released,detectedTotal,sales,pct,base,rawCommission,minimum,minimumComplement,fixed,spiff,bonus,advance,deductions,companyDebt,companyDebtReason,net,role,commissionBase:$('commissionBase').value,competenceMonth,competenceYear,cashReleaseThreshold};
 renderCalc(lastCalc);
 await saveProfile();
 if(!demoMode&&currentFile){
   const {error}=await db.from('borderox_statements').insert({
     user_id:currentUser.id,file_name:currentFile.name,period_label:$('periodLabel').value||null,
     detected_total:detectedTotal,detected_vgv:vgv,detected_released:released,detected_sales:sales,
     calculation:lastCalc,extracted_text:extractedText.slice(0,50000)
   });
   if(error)$('fileStatus').textContent='Cálculo pronto, mas o histórico não pôde ser salvo: '+error.message;
   else await loadHistory();
 }
 window.scrollTo({top:0,behavior:'smooth'});
}

function renderCalc(c){
 $('netValue').textContent=money(c.net);$('vgvValue').textContent=money(c.vgv);$('releasedValue').textContent=money(c.released);
 $('commissionValue').textContent=money(c.rawCommission);$('salesValue').textContent=c.sales;$('netHint').textContent=roleName(c.role)+' · '+c.pct.toLocaleString('pt-BR')+'% de comissão';
 $('breakdownPanel').classList.remove('hidden');
 const rows=[
   ['Base da comissão',money(c.base)],['Comissão apurada ('+c.pct.toLocaleString('pt-BR')+'%)',money(c.rawCommission)],
   ['Complemento de mínimo garantido',money(c.minimumComplement)],['Fixo',money(c.fixed)],['SPIFF',money(c.spiff)],
   ['Outros bônus',money(c.bonus)],['Adiantamento de comissão','− '+money(c.advance)],['Outros descontos','− '+money(c.deductions)],
   ['Débito/desconto com a empresa'+(c.companyDebtReason?' — '+escapeHtml(c.companyDebtReason):''),'− '+money(c.companyDebt)],
   ['Regra de liberação à vista','Cliente com entrada/integralização ≥ '+c.cashReleaseThreshold+'%']
 ];
 $('breakdown').innerHTML=rows.map(([a,b])=>'<div><span>'+a+'</span><strong>'+b+'</strong></div>').join('')+'<div class="total"><span>VALOR A RECEBER</span><strong>'+money(c.net)+'</strong></div>';
}

async function loadHistory(){
 const {data}=await db.from('borderox_statements').select('id,file_name,period_label,detected_vgv,calculation,created_at').order('created_at',{ascending:false}).limit(200);
 borderoxHistoryCache=data||[]; renderHistory(borderoxHistoryCache);
}
function renderHistory(items){
 renderYearSummary(items);
 const year=Number($('historyYear')?.value)||new Date().getFullYear();
 const filtered=items.filter(x=>{const c=x.calculation||{};return Number(c.competenceYear)===year&&(!selectedHistoryMonth||Number(c.competenceMonth)===selectedHistoryMonth)});
 renderMonthDetail(filtered,year,selectedHistoryMonth);
 if(!filtered.length){$('history').innerHTML='<p class="muted">Nenhum borderô encontrado para este período.</p>';return}
 $('history').innerHTML=filtered.map(x=>{
   const c=x.calculation||{}; const label=(c.competenceMonth&&c.competenceYear)?MONTHS[c.competenceMonth-1]+' / '+c.competenceYear:(x.period_label||new Date(x.created_at).toLocaleDateString('pt-BR'));
   return '<div class="historyItem"><div><strong>'+escapeHtml(x.file_name)+'</strong><small>'+escapeHtml(label)+'</small></div><b>'+money(c.net||0)+'</b></div>';
 }).join('');
}
function renderYearSummary(items){
 if(!$('yearSummary'))return;
 const year=Number($('historyYear')?.value)||new Date().getFullYear();
 const totals=Array(12).fill(0),counts=Array(12).fill(0);
 let annual=0,annualCount=0;
 for(const x of items){
   const c=x.calculation||{};
   if(Number(c.competenceYear)===year&&Number(c.competenceMonth)>=1&&Number(c.competenceMonth)<=12){
     const idx=Number(c.competenceMonth)-1;
     totals[idx]+=Number(c.net)||0;counts[idx]++;annual+=Number(c.net)||0;annualCount++;
   }
 }
 if($('annualTotalValue'))$('annualTotalValue').textContent=money(annual);
 if($('annualTotalMeta'))$('annualTotalMeta').textContent=annualCount+' borderô'+(annualCount===1?'':'s')+' em '+year;
 $('yearSummary').innerHTML=MONTHS.map((m,i)=>'<button type="button" class="monthCard '+(selectedHistoryMonth===i+1?'selected':'')+'" data-month="'+(i+1)+'"><span>'+m+'</span><strong>'+money(totals[i])+'</strong><small>'+counts[i]+' borderô'+(counts[i]===1?'':'s')+'</small></button>').join('');
}
function renderMonthDetail(items,year,month){
 if(!$('monthDetail'))return;
 if(!month){$('monthDetail').classList.add('hidden');$('monthDetail').innerHTML='';return}
 const sums=items.reduce((acc,x)=>{const c=x.calculation||{};acc.net+=Number(c.net)||0;acc.vgv+=Number(c.vgv)||0;acc.sales+=Number(c.sales)||0;acc.commission+=Number(c.rawCommission)||0;acc.fixed+=Number(c.fixed)||0;acc.spiff+=Number(c.spiff)||0;acc.advance+=Number(c.advance)||0;acc.discounts+=(Number(c.deductions)||0)+(Number(c.companyDebt)||0);acc.released+=Number(c.released)||0;return acc},{net:0,vgv:0,sales:0,commission:0,fixed:0,spiff:0,advance:0,discounts:0,released:0});
 $('monthDetail').classList.remove('hidden');
 $('monthDetail').innerHTML='<div class="monthDetailHead"><div><span class="eyebrow">RESUMO DO MÊS</span><h4>'+MONTHS[month-1]+' / '+year+'</h4></div><button type="button" class="miniClose" id="closeMonthDetail">Fechar</button></div>'+
 '<div class="monthMetrics">'+
 '<div><span>Valor líquido</span><strong>'+money(sums.net)+'</strong></div>'+
 '<div><span>VGV</span><strong>'+money(sums.vgv)+'</strong></div>'+
 '<div><span>Vendas</span><strong>'+sums.sales+'</strong></div>'+
 '<div><span>Comissão bruta</span><strong>'+money(sums.commission)+'</strong></div>'+
 '<div><span>Fixo</span><strong>'+money(sums.fixed)+'</strong></div>'+
 '<div><span>SPIFF</span><strong>'+money(sums.spiff)+'</strong></div>'+
 '<div><span>Adiantamentos</span><strong>− '+money(sums.advance)+'</strong></div>'+
 '<div><span>Descontos</span><strong>− '+money(sums.discounts)+'</strong></div>'+
 '<div><span>Liberado no mês</span><strong>'+money(sums.released)+'</strong></div>'+
 '</div><p class="muted">Regra ativa: vendas com 2% ou mais de entrada/integralização são tratadas como comissão liberada à vista.</p>';
 const close=$('closeMonthDetail');if(close)close.onclick=()=>{selectedHistoryMonth=null;renderHistory(borderoxHistoryCache)};
}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=borderox-v12-monthly',{updateViaCache:'none'}).catch(()=>{}));
}

let borderoxHistoryCache=[];
let selectedHistoryMonth=null;
if($('historyYear')) $('historyYear').addEventListener('change',()=>{selectedHistoryMonth=null;renderHistory(borderoxHistoryCache)});
if($('yearSummary')) $('yearSummary').addEventListener('click',e=>{
  const card=e.target.closest('[data-month]');
  if(!card)return;
  selectedHistoryMonth=Number(card.dataset.month);
  renderHistory(borderoxHistoryCache);
});
