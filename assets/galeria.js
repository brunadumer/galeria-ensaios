(function(){
'use strict';
var estado = {};
try { estado = JSON.parse(document.getElementById('estado').textContent) || {}; } catch(e) {}
var fotos = Array.isArray(estado.fotos) ? estado.fotos : [];
var root = document.getElementById('root');
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function dataBonita(iso){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  var p = iso.split('-').map(Number);
  return p[2] + ' de ' + MESES[p[1]-1] + ' de ' + p[0];
}

// No celular, "Salvar" abre a folha de compartilhar, que deixa a foto ir direto para a galeria do aparelho.
var toque = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
var podeCompartilhar = false;
try { podeCompartilhar = toque && !!navigator.canShare && navigator.canShare({files:[new File([''], 'foto.jpg', {type:'image/jpeg'})]}); } catch(e) {}

var ICONE = {
  baixar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  fechar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ant:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  prox:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>'
};

/* ---------- Aviso ---------- */
var avisoEl = document.createElement('div');
avisoEl.className = 'aviso'; avisoEl.hidden = true; avisoEl.setAttribute('role','status'); avisoEl.setAttribute('aria-live','polite');
document.body.appendChild(avisoEl);
var avisoTimer = null;
function aviso(msg){
  avisoEl.textContent = msg; avisoEl.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(function(){ avisoEl.hidden = true; }, 3800);
}

/* ---------- Página ---------- */
function render(){
  var capa = null;
  for (var k = 0; k < fotos.length; k++) if (fotos[k].id === estado.capa) capa = fotos[k];
  var sub = [estado.titulo, dataBonita(estado.data)].filter(Boolean).join(', ');
  var h = '';

  h += '<header class="hero' + (capa ? '' : ' sem-capa') + '">';
  if (capa) h += '<img src="' + esc(capa.mini) + '" alt="" fetchpriority="high">';
  h += '<div class="hero-texto"><h1>' + esc(estado.cliente || 'Seu ensaio') + '</h1>';
  if (sub) h += '<p class="hero-sub">' + esc(sub) + '</p>';
  if (estado.estudio) h += '<p class="hero-credito">Fotos por ' + esc(estado.estudio) + '</p>';
  h += '</div></header>';

  if (fotos.length){
    h += '<section class="barra"><p class="contagem">' + fotos.length + (fotos.length === 1 ? ' foto' : ' fotos') + '</p>';
    h += '<a class="btn" href="' + esc(estado.zip) + '" download>' + ICONE.baixar + '<span>Baixar todas (.zip)</span></a>';
    if (podeCompartilhar) h += '<p class="dica-salvar">Para guardar no celular, abra a foto e toque em Salvar.</p>';
    h += '</section><main class="grade">';
    fotos.forEach(function(f, i){
      h += '<div class="item"><button class="foto" data-i="' + i + '" style="aspect-ratio:' + (f.w || 4) + '/' + (f.h || 5) + '" aria-label="Abrir foto ' + (i+1) + '">';
      h += '<img src="' + esc(f.mini) + '" alt="" loading="lazy" decoding="async"></button></div>';
    });
    h += '</main>';
  } else {
    h += '<section class="vazio"><p>As fotos do seu ensaio aparecem aqui assim que estiverem prontas.</p></section>';
  }

  h += '<footer class="rodape">';
  if (estado.estudio) h += '<p><strong>' + esc(estado.estudio) + '</strong></p>';
  h += '<p>Para ter suas fotos sempre à mão, salve esta página na tela de início. No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início”. No Android, abra o menu do navegador e escolha “Adicionar à tela inicial”.</p>';
  h += '</footer>';
  root.innerHTML = h;
}

root.addEventListener('click', function(e){
  var b = e.target.closest('.foto');
  if (b) abrirLB(Number(b.dataset.i));
});
root.addEventListener('error', function(e){
  if (e.target && e.target.tagName === 'IMG'){ var it = e.target.closest('.item'); if (it) it.classList.add('quebrada'); }
}, true);

/* ---------- Salvar no celular ---------- */
var cache = {id:null, blob:null, prom:null};
function prebuscar(f){
  if (!podeCompartilhar || cache.id === f.id) return;
  var c = cache = {id:f.id, blob:null, prom:null};
  c.prom = fetch(f.src).then(function(r){ if (!r.ok) throw new Error('fetch'); return r.blob(); })
    .then(function(b){ c.blob = b; return b; });
  c.prom.catch(function(){});
}
async function salvar(){
  var f = fotos[lbI];
  prebuscar(f);
  var c = cache;
  try {
    var b = c.blob || await c.prom;
    await navigator.share({files:[new File([b], f.arquivo, {type:b.type || 'image/jpeg'})]});
  } catch(e) {
    if (e && e.name === 'AbortError') return;
    // Alguns iPhones exigem um toque "fresco" depois que a foto termina de carregar.
    if (e && e.name === 'NotAllowedError' && c.blob){ aviso('Foto pronta. Toque em Salvar de novo.'); return; }
    location.href = f.baixar;
  }
}

/* ---------- Foto ampliada ---------- */
var lb = document.createElement('div');
lb.className = 'lb'; lb.hidden = true;
lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.setAttribute('aria-label','Foto ampliada');
lb.innerHTML = '<div class="lb-topo"><span class="lb-contador"></span><button class="lb-btn" data-lb="fechar" aria-label="Fechar">' + ICONE.fechar + '</button></div>' +
  '<div class="lb-palco"><img alt=""></div>' +
  '<div class="lb-base"><button class="lb-btn" data-lb="ant" aria-label="Foto anterior">' + ICONE.ant + '</button>' +
  '<span class="lb-meio"></span>' +
  '<button class="lb-btn" data-lb="prox" aria-label="Próxima foto">' + ICONE.prox + '</button></div>';
document.body.appendChild(lb);
var lbImg = lb.querySelector('img'), lbCont = lb.querySelector('.lb-contador'), lbMeio = lb.querySelector('.lb-meio');
var lbI = 0, ultimoFoco = null;

function abrirLB(i){
  if (!fotos[i]) return;
  ultimoFoco = document.activeElement;
  lbI = i; lb.hidden = false; document.body.classList.add('travado');
  mostrarLB();
  lb.querySelector('[data-lb="fechar"]').focus();
}
function fecharLB(){
  lb.hidden = true; document.body.classList.remove('travado'); lbImg.removeAttribute('src');
  if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
}
function mostrarLB(){
  var f = fotos[lbI], n = fotos.length;
  lbImg.src = f.mini;
  var cheia = new Image();
  cheia.onload = function(){ if (fotos[lbI] === f && !lb.hidden) lbImg.src = cheia.src; };
  cheia.src = f.src;
  lbCont.textContent = (lbI + 1) + ' de ' + n;
  lb.querySelector('[data-lb="ant"]').disabled = lbI === 0;
  lb.querySelector('[data-lb="prox"]').disabled = lbI === n - 1;
  lbMeio.innerHTML = podeCompartilhar
    ? '<button class="btn cheio" data-lb="salvar">' + ICONE.baixar + '<span>Salvar foto</span></button>'
    : '<a class="btn cheio" href="' + esc(f.baixar) + '" download>' + ICONE.baixar + '<span>Baixar foto</span></a>';
  prebuscar(f);
  [lbI - 1, lbI + 1].forEach(function(j){ if (fotos[j]){ var p = new Image(); p.src = fotos[j].mini; } });
}
function navLB(d){ var j = lbI + d; if (j >= 0 && j < fotos.length){ lbI = j; mostrarLB(); } }
lb.addEventListener('click', function(e){
  var b = e.target.closest('[data-lb]');
  if (!b){ if (e.target === lb.querySelector('.lb-palco')) fecharLB(); return; }
  var a = b.dataset.lb;
  if (a === 'fechar') fecharLB(); else if (a === 'ant') navLB(-1); else if (a === 'prox') navLB(1); else if (a === 'salvar') salvar();
});
document.addEventListener('keydown', function(e){
  if (lb.hidden) return;
  if (e.key === 'Escape') fecharLB(); else if (e.key === 'ArrowLeft') navLB(-1); else if (e.key === 'ArrowRight') navLB(1);
});
var tx = 0, ty = 0, toques = 0;
var palco = lb.querySelector('.lb-palco');
palco.addEventListener('touchstart', function(e){ toques = e.touches.length; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, {passive:true});
palco.addEventListener('touchend', function(e){
  if (toques !== 1) return;
  var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) navLB(dx < 0 ? 1 : -1);
}, {passive:true});

/* ---------- Início ---------- */
document.documentElement.classList.add('animar');
setTimeout(function(){ document.documentElement.classList.remove('animar'); }, 2200);
render();
})();
