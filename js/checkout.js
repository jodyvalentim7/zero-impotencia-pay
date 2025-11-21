// Checkout logic moved out of HTML
// Elements
const form = document.getElementById('checkoutForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const phoneError = document.getElementById('phoneError');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const formTitle = document.getElementById('form-title');
const leadEl = document.querySelector('.lead');
const refOverlay = document.getElementById('refOverlay');
const generateRef = document.getElementById('generateRef');
const backToStep1 = document.getElementById('backToStep1');
const entidadeEl = document.getElementById('entidade');
const referenciaEl = document.getElementById('referencia');
const valorEl = document.getElementById('valorRef');
const productPriceEl = document.querySelector('.product-price');
const summaryNome = document.getElementById('summaryNome');
const summaryEmail = document.getElementById('summaryEmail');
const summaryPhone = document.getElementById('summaryPhone');
const doneBtn = document.getElementById('doneBtn');
const paymentRefCheckbox = document.getElementById('paymentRefCheckbox');
const paymentError = document.getElementById('paymentError');
const paidBtn = document.getElementById('paidBtn');

let payload = null;

// load persisted settings (admin panel saves here)
const SETTINGS_KEY = 'sevenpay.settings';
function loadSettings(){
  try{ const raw = localStorage.getItem(SETTINGS_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}

function applySettings(){
  const s = loadSettings();
  if(!s) return;
  // product image
  const thumb = document.querySelector('.product-thumb img');
  if(thumb && s.image) thumb.src = s.image;
  // name and price
  const nameEl = document.querySelector('.product-name');
  const priceEl = document.querySelector('.product-price');
  if(nameEl && s.name) nameEl.textContent = s.name;
  if(priceEl && s.price) priceEl.textContent = s.price;
  // prefill entidade/referencia if present
  if(entidadeEl && s.entidade) entidadeEl.value = s.entidade;
  if(referenciaEl && s.referencia) referenciaEl.value = s.referencia;
}

// apply settings on load
document.addEventListener('DOMContentLoaded', applySettings);
// listen for settings changes from other windows/tabs (admin saves)
window.addEventListener('storage', function(e){
  if(e.key === SETTINGS_KEY){ applySettings(); }
});

function goToStep(n){
  // map logical step numbers to DOM elements explicitly so missing steps don't break numbering
  const map = {1: step1, 2: step2, 3: step3};
  Object.keys(map).forEach(k=>{
    const num = Number(k);
    const el = map[k];
    if(!el) return;
    if(num === n){ el.classList.add('active'); el.removeAttribute('aria-hidden'); }
    else { el.classList.remove('active'); el.setAttribute('aria-hidden','true'); }
  });
  // hide header/lead on step 3 to avoid duplicate messaging
  if(formTitle) formTitle.style.display = (n === 3) ? 'none' : '';
  if(leadEl) leadEl.style.display = (n === 3) ? 'none' : '';
  // show reference overlay only on step 3
  if(refOverlay) refOverlay.style.display = (n === 3) ? 'block' : 'none';
  window.scrollTo({top:0,behavior:'smooth'});
}

function validatePhone(value){
  let digits = value.replace(/\D/g,'');
  if(digits.startsWith('244')) digits = digits.slice(3);
  digits = digits.replace(/^0+/, '');
  return digits.length === 9;
}

function formatAngolaPhone(input){
  let v = input.value || '';
  let digits = v.replace(/\D/g,'');
  if(digits.startsWith('244')) digits = digits.slice(3);
  digits = digits.replace(/^0+/, '');
  digits = digits.slice(0,9);
  const parts = [];
  if(digits.length > 0) parts.push(digits.slice(0,3));
  if(digits.length > 3) parts.push(digits.slice(3,6));
  if(digits.length > 6) parts.push(digits.slice(6,9));
  input.value = parts.join(' ');
}

function showError(element, msg){ element.textContent = msg; element.style.display = msg ? 'block' : 'none'; }

// phone formatting
phoneInput.addEventListener('input', () => formatAngolaPhone(phoneInput));

// (clear button removed from UI) -- keep programmatic helper if needed
function clearForm(){ form.reset(); showError(nameError,''); showError(emailError,''); showError(phoneError,''); nameInput.focus(); }

// STEP 1 submit -> go to step2
form.addEventListener('submit', function(e){
  e.preventDefault();
  showError(nameError,''); showError(emailError,''); showError(phoneError,'');
  let valid = true;
  if(!nameInput.value.trim()){ showError(nameError,'Informe seu nome.'); valid = false; }
  if(!emailInput.checkValidity()){ showError(emailError,'Informe um e‑mail válido.'); valid = false; }
  if(!validatePhone(phoneInput.value)){ showError(phoneError,'Informe um telefone angolano válido (9 dígitos). Ex: 925 000 000'); valid = false; }
  // payment method must be selected
  if(paymentRefCheckbox && !paymentRefCheckbox.checked){
    showError(paymentError,'Selecione o método de pagamento: Pagamento por Referência.');
    valid = false;
  } else if(paymentError){ showError(paymentError,''); }
  if(!valid) return;

  // determine product value and format with two decimals (no currency prefix)
  function formatPriceFromText(text){
    if(!text) return '0,00';
    // extract digits
    const digits = (text + '').replace(/[^0-9]/g, '');
    const n = parseInt(digits || '0', 10);
    const formatted = n.toLocaleString('pt-PT', {minimumFractionDigits:2});
    return formatted;
  }
  const valorFormatted = formatPriceFromText(productPriceEl ? productPriceEl.textContent : '0');
  payload = { nome: nameInput.value.trim(), email: emailInput.value.trim(), telefone: phoneInput.value.trim(), valor: valorFormatted };
  // populate summary for step3
  summaryNome.textContent = payload.nome ? payload.nome : '';
  summaryEmail.textContent = payload.email ? payload.email : '';
  summaryPhone.textContent = payload.telefone ? payload.telefone : '';

  // create sale via backend (public endpoint). Save returned sale id so buyer can mark as pending.
  try{
    const productId = new URLSearchParams(window.location.search).get('product') || (productPriceEl ? productPriceEl.getAttribute('data-product-id') : null);
    const saleBody = { nome: payload.nome, email: payload.email, telefone: payload.telefone, productId };
    // fire-and-forget but attempt to store returned id
    fetch('/api/sales', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(saleBody), keepalive: true })
      .then(r=>{ if(!r.ok) return null; return r.json(); })
      .then(sale=>{ if(sale && sale.id) localStorage.setItem('sevenpay.lastSaleId', sale.id); })
      .catch(()=>{});
  }catch(e){ /* ignore */ }

  // show processing state on the submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  if(submitBtn){
    // create spinner element
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    // backup text
    const oldText = submitBtn.textContent;
    submitBtn.prepend(spinner);
    submitBtn.disabled = true;
    submitBtn.childNodes.forEach(n=>{ if(n.nodeType===3) n.textContent = ' Processando'; });

      // show processing on the button for 1.5s, then generate ref and go to step 3
  const PROCESSING_MS = 2000; // 2 seconds
      setTimeout(()=>{
        // auto-generate reference if step3 exists
        if(step3){
          const entidade = '10116';
          const referencia = '929199824';
          if(entidadeEl) entidadeEl.value = entidade;
          if(referenciaEl) referenciaEl.value = referencia;
          if(valorEl) valorEl.value = payload.valor;
          goToStep(3);
        }
        submitBtn.disabled = false;
        // remove spinner and restore label
        spinner.remove();
        submitBtn.childNodes.forEach(n=>{ if(n.nodeType===3) n.textContent = oldText; });
      }, PROCESSING_MS);
  } else {
    // fallback: immediate to step 3
    goToStep(3);
  }
});

if(backToStep1) backToStep1.addEventListener('click', ()=> goToStep(1));

// generate reference
if(generateRef) generateRef.addEventListener('click', function(){
  if(!payload){ alert('Preencha seus dados primeiro.'); goToStep(1); return; }
  const entidade = '10116';
  const referencia = '929199824';
  if(entidadeEl) entidadeEl.value = entidade;
  if(referenciaEl) referenciaEl.value = referencia;
  if(valorEl) valorEl.value = payload.valor;
  if(step3) goToStep(3);
});

// copy buttons (delegation)
document.addEventListener('click', function(e){
  const btn = e.target.closest('.copyBtn');
  if(!btn) return;
  const targetId = btn.getAttribute('data-copy-target');
  const el = document.getElementById(targetId);
  if(!el) return;
  const text = el.value || el.textContent || '';
  // remove leading currency prefix for valorRef when copying
  let copyText = text;
  if(targetId === 'valorRef'){
    copyText = copyText.replace(/^\s*(kz|Kz|KZ)\s*/,'');
  }
  navigator.clipboard.writeText(copyText).then(()=>{
    const original = btn.textContent;
    btn.textContent = 'Copiado!';
    setTimeout(()=> btn.textContent = original, 1600);
  }).catch(()=>{
    alert('Não foi possível copiar.');
  });
});

// done button (guarded in case button was removed)
if(doneBtn) doneBtn.addEventListener('click', function(){
  alert('Referência gerada. Copie os dados e finalize o pagamento na sua agência ou app bancário.');
  form.reset();
  goToStep(1);
});

// 'Já paguei' is an anchor to WhatsApp; also try to mark the sale as pending via API
if(paidBtn) paidBtn.addEventListener('click', function(e){
  try{
    const saleId = localStorage.getItem('sevenpay.lastSaleId');
    if(!saleId) return; // nothing to update
    const url = '/api/sales/'+saleId+'/pending';
    // prefer sendBeacon for navigation-safe fire-and-forget, fall back to fetch with keepalive
    const payload = '';
    if(navigator.sendBeacon){
      navigator.sendBeacon(url, payload);
    } else {
      fetch(url, { method: 'POST', keepalive: true }).catch(()=>{});
    }
    showToast('PENDENTE');
  }catch(err){ /* ignore */ }
});

// Toast notifications (bottom-left)
const toastWrap = document.querySelector('.toast-wrap');
function showToast(name){
  // Toasts disabled: function intentionally left as no-op
  return;
}

// Two lists (masculine/feminine) and alternating generator
const maleNames = ['Miguel','João','Pedro','Tiago','Bruno','Carlos','Daniel','Eduardo','Filipe','Gonçalo','Hélder','Ivan','José','Luís','Manuel','Rui','António','Nuno'];
const femaleNames = ['Ana','Maria','Joana','Sofia','Inês','Clara','Mariana','Beatriz','Carla','Daniela','Filipa','Graça','Helena','Isabel','Lara','Paula','Rafaela','Vera'];

let maleIndex = 0, femaleIndex = 0, pickMaleNext = true;
function getNextName(){
  let name;
  if(pickMaleNext){
    name = maleNames[maleIndex % maleNames.length];
    maleIndex++;
  } else {
    name = femaleNames[femaleIndex % femaleNames.length];
    femaleIndex++;
  }
  pickMaleNext = !pickMaleNext;
  return name;
}

// Note: immediate toast on form submit removed (periodic toasts still run)

// Periodic alternating toasts to simulate activity: every 15 seconds
function randomToast(){ showToast(getNextName()); }
// periodic toasts disabled
