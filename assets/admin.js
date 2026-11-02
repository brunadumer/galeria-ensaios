(function(){
'use strict';
var root = document.getElementById('root');
var BASE = document.body.dataset.base || '';
var API = BASE + '/admin/api.php';
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

var st = {csrf:'', configurado:false, logado:false, estudio:'', limite:8 * 1024 * 1024};
var atual = null;              // galeria aberta
var enviando = false;
var confirmando = null, confirmTimer = null, salvarTimer = null;

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function dataBonita(iso){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  var p = iso.split('-').map(Number);
  return p[2] + ' de ' + MESES[p[1]-1] + ' de ' + p[0];
}
function plural(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); }
function $(id){ return document.getElementById(id); }

/* ---------- Aviso ---------- */
var avisoEl = document.createElement('div');
avisoEl.className = 'aviso'; avisoEl.hidden = true; avisoEl.setAttribute('role','status'); avisoEl.setAttribute('aria-live','polite');
document.body.appendChild(avisoEl);
var avisoTimer = null;
function aviso(msg, fixo){
  avisoEl.textContent = msg; avisoEl.hidden = false;
  clearTimeout(avisoTimer);
  if (!fixo) avisoTimer = setTimeout(function(){ avisoEl.hidden = true; }, 4000);
}

/* ---------- Servidor ---------- */
async function api(acao, dados, arquivos){
  var fd = new FormData();
  fd.append('acao', acao);
  Object.keys(dados || {}).forEach(function(k){ fd.append(k, dados[k] == null ? '' : dados[k]); });
  Object.keys(arquivos || {}).forEach(function(k){ fd.append(k, arquivos[k].blob, arquivos[k].nome); });
  var r, j = null;
  try { r = await fetch(API, {method:'POST', body:fd, headers:{'X-CSRF':st.csrf}, credentials:'same-origin'}); }
  catch(e){ throw {msg:'Sem conexão. Verifique a internet e tente de novo.'}; }
  try { j = await r.json(); } catch(e) {}
  if (!r.ok || !j || j.erro){
    if (r.status === 401 && acao !== 'entrar'){ st.logado = false; mostrar(); }
    var msg = (j && j.erro) || (r.status === 413 ? 'A foto é grande demais para o servidor.' : 'Algo deu errado (' + r.status + '). Tente de novo.');
    throw {msg:msg, status:r.status};
  }
  return j;
}

function linkGaleria(g){ return location.origin + BASE + '/' + g.id; }

/* ---------- Telas ---------- */
function topo(){
  return '<header class="adm-topo"><a class="marca" href="#/">' + esc(st.estudio || 'Minhas galerias') + '</a>' +
    '<nav class="nav"><a class="btn-texto" href="#/">Galerias</a><a class="btn-texto" href="#/ajustes">Ajustes</a>' +
    '<button class="btn-texto" data-acao="sair">Sair</button></nav></header>';
}
function pagina(miolo){ root.innerHTML = '<div class="adm">' + topo() + miolo + '</div>'; }

function mostrar(){
  clearTimeout(salvarTimer);
  confirmando = null;
  if (!st.configurado) return telaConfigurar();
  if (!st.logado) return telaEntrar();
  var h = location.hash.replace(/^#/, '') || '/', m;
  if (h === '/nova') telaNova();
  else if (h === '/ajustes') telaAjustes();
  else if ((m = h.match(/^\/g\/([a-z0-9-]+)$/))) telaGaleria(m[1]);
  else telaLista();
}
window.addEventListener('hashchange', function(){
  if (enviando){ aviso('Espere o envio das fotos terminar.'); return; }
  mostrar();
});
window.addEventListener('beforeunload', function(e){ if (enviando){ e.preventDefault(); e.returnValue = ''; } });

function formEntrada(titulo, sub, campos, botao, id){
  return '<div class="entrada"><form id="' + id + '" novalidate><h1>' + titulo + '</h1><p class="sub">' + sub + '</p>' +
    campos + '<p class="erro" id="erro" role="alert"></p><button class="btn cheio largo" type="submit">' + botao + '</button></form></div>';
}
function campo(nome, rotulo, valor, tipo, extra){
  return '<label class="campo">' + esc(rotulo) + '<input name="' + nome + '" type="' + (tipo || 'text') + '" value="' + esc(valor || '') + '"' + (extra || '') + '></label>';
}
function enviarForm(form, fn){
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var b = form.querySelector('[type=submit]'), erro = form.querySelector('.erro');
    b.disabled = true; if (erro) erro.textContent = '';
    try { await fn(new FormData(form)); }
    catch(x){ if (erro) erro.textContent = x.msg || 'Algo deu errado.'; else aviso(x.msg); }
    b.disabled = false;
  });
}

function telaConfigurar(){
  root.innerHTML = formEntrada('Bem-vinda', 'Configure sua área para criar as galerias das clientes.',
    campo('estudio', 'Seu nome ou estúdio', '', 'text', ' autocomplete="organization" required') +
    campo('senha', 'Crie uma senha (mínimo 8 caracteres)', '', 'password', ' autocomplete="new-password" minlength="8" required') +
    campo('senha2', 'Repita a senha', '', 'password', ' autocomplete="new-password" required'),
    'Começar', 'f-config');
  enviarForm($('f-config'), async function(d){
    if (d.get('senha') !== d.get('senha2')) throw {msg:'As senhas não são iguais.'};
    await api('configurar', {estudio:d.get('estudio'), senha:d.get('senha')});
    await carregarEstado(); location.hash = '#/'; mostrar();
  });
}

function telaEntrar(){
  root.innerHTML = formEntrada(esc(st.estudio || 'Minhas galerias'), 'Entre para criar e enviar as galerias.',
    campo('senha', 'Senha', '', 'password', ' autocomplete="current-password" required autofocus'),
    'Entrar', 'f-entrar');
  enviarForm($('f-entrar'), async function(d){
    await api('entrar', {senha:d.get('senha')});
    await carregarEstado(); mostrar();
  });
}

async function telaLista(){
  pagina('<p class="carregando">Carregando…</p>');
  var j;
  try { j = await api('listar'); } catch(e){ return pagina('<p class="erro">' + esc(e.msg) + '</p>'); }
  var h = '<div class="titulo-pg"><h1>Galerias</h1><a class="btn cheio" href="#/nova">Nova galeria</a></div>';
  if (!j.galerias.length){
    h += '<div class="vazio-adm"><p>Nenhuma galeria ainda.</p><p>Crie uma galeria para cada ensaio, envie as fotos e mande o link para a cliente.</p></div>';
  } else {
    h += '<ul class="lista">';
    j.galerias.forEach(function(g){
      var sub = [g.titulo, dataBonita(g.data)].filter(Boolean).join(', ');
      h += '<li><a class="cartao" href="#/g/' + esc(g.id) + '">' +
        (g.capa ? '<img src="' + esc(g.capa) + '" alt="" loading="lazy">' : '<span class="sem-foto"></span>') +
        '<span class="cartao-txt"><strong>' + esc(g.cliente) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') +
        '<span>' + plural(g.total, 'foto', 'fotos') + '</span></span><span class="seta" aria-hidden="true">›</span></a></li>';
    });
    h += '</ul>';
  }
  pagina(h);
}

function telaNova(){
  pagina('<a class="btn-texto voltar" href="#/">‹ Galerias</a><div class="titulo-pg"><h1>Nova galeria</h1></div>' +
    '<form class="caixa" id="f-nova" novalidate>' +
    campo('cliente', 'Nome da cliente', '', 'text', ' placeholder="Ana Ribeiro" autocomplete="off" required') +
    '<div class="colunas">' + campo('titulo', 'Ensaio', '', 'text', ' placeholder="Ensaio gestante" autocomplete="off"') +
    campo('data', 'Data do ensaio', '', 'date') + '</div>' +
    '<p class="erro" id="erro" role="alert"></p><button class="btn cheio" type="submit">Criar e enviar fotos</button></form>');
  var f = $('f-nova');
  f.querySelector('[name=cliente]').focus();
  enviarForm(f, async function(d){
    var j = await api('criar', {cliente:d.get('cliente'), titulo:d.get('titulo'), data:d.get('data')});
    atual = j.galeria;
    location.hash = '#/g/' + atual.id;
  });
}

async function telaGaleria(id){
  if (!atual || atual.id !== id){
    pagina('<p class="carregando">Carregando…</p>');
    try { atual = (await api('obter', {id:id})).galeria; }
    catch(e){ return pagina('<a class="btn-texto voltar" href="#/">‹ Galerias</a><p class="erro">' + esc(e.msg) + '</p>'); }
  }
  var g = atual;
  var h = '<a class="btn-texto voltar" href="#/">‹ Galerias</a>';
  h += '<div class="titulo-pg"><h1 id="t-nome">' + esc(g.cliente) + '</h1><a class="btn" href="' + esc(linkGaleria(g)) + '" target="_blank" rel="noopener">Ver como a cliente</a></div>';

  h += '<section class="caixa"><h2>Enviar para a cliente</h2><p class="sub">Quem tem o link vê e baixa as fotos. Ele não aparece no Google.</p>';
  h += '<label class="campo">Link da galeria<input id="link" type="text" readonly value="' + esc(linkGaleria(g)) + '"></label>';
  h += '<div class="linha-btns"><button class="btn cheio" data-acao="whatsapp">Enviar no WhatsApp</button><button class="btn" data-acao="copiar">Copiar link</button></div></section>';

  h += '<section class="caixa"><h2>Fotos</h2><p class="sub">Escolha várias de uma vez. Elas entram em ordem pelo nome do arquivo.</p>';
  h += '<div class="envio" id="zona"><button class="btn cheio" data-acao="escolher">Adicionar fotos</button>';
  h += '<input type="file" id="arquivo" accept="image/*,.heic,.heif" multiple hidden>';
  h += '<p id="progresso" aria-live="polite">Ou arraste as fotos para cá. JPG, PNG, WEBP ou HEIC.</p></div>';
  h += '<div id="fotos"></div></section>';

  h += '<section class="caixa"><h2>Dados do ensaio</h2><p class="sub">Aparecem na capa da galeria. Salvos automaticamente.</p>';
  h += campo('cliente', 'Nome da cliente', g.cliente, 'text', ' data-campo autocomplete="off"');
  h += '<div class="colunas">' + campo('titulo', 'Ensaio', g.titulo, 'text', ' data-campo autocomplete="off" placeholder="Ensaio gestante"') +
    campo('data', 'Data do ensaio', g.data, 'date', ' data-campo') + '</div>';
  h += '<p class="status" id="salvo" aria-live="polite"></p></section>';

  h += '<section class="zona-perigo"><button class="btn perigo" data-acao="excluir" id="btn-excluir">Excluir galeria</button>';
  h += '<p>Apaga a galeria e todas as fotos do servidor. O link deixa de funcionar.</p></section>';
  pagina(h);
  renderFotos();
  ligarGaleria();
}

function renderFotos(){
  var el = $('fotos'); if (!el) return;
  var g = atual, h = '';
  if (g.fotos.length){
    h += '<div class="barra"><p class="contagem">' + plural(g.fotos.length, 'foto', 'fotos') + '</p></div><div class="grade">';
    g.fotos.forEach(function(f){
      h += '<div class="item"><div class="foto" style="aspect-ratio:' + (f.w || 4) + '/' + (f.h || 5) + '"><img src="' + esc(f.mini) + '" alt="" loading="lazy" decoding="async"></div>';
      h += '<div class="acoes">';
      h += f.id === g.capa ? '<span class="chip">Capa</span>' : '<button class="mini" data-acao="capa" data-f="' + f.id + '">Usar como capa</button>';
      var conf = confirmando === f.id;
      h += '<button class="mini ' + (conf ? 'confirmar' : 'perigo') + '" data-acao="remover" data-f="' + f.id + '">' + (conf ? 'Confirmar' : 'Remover') + '</button>';
      h += '</div></div>';
    });
    h += '</div>';
  }
  el.innerHTML = h;
}

function ligarGaleria(){
  root.querySelectorAll('[data-campo]').forEach(function(inp){
    inp.addEventListener('input', function(){
      if (inp.name === 'cliente') $('t-nome').textContent = inp.value || 'Nome da cliente';
      $('salvo').textContent = '';
      clearTimeout(salvarTimer);
      salvarTimer = setTimeout(salvarDados, 700);
    });
  });
  var arq = $('arquivo');
  arq.addEventListener('change', function(){ if (arq.files && arq.files.length) enviar(Array.from(arq.files)); arq.value = ''; });
  var zona = $('zona');
  ['dragenter','dragover'].forEach(function(t){ zona.addEventListener(t, function(e){ e.preventDefault(); zona.classList.add('arrastando'); }); });
  ['dragleave','drop'].forEach(function(t){ zona.addEventListener(t, function(e){ e.preventDefault(); zona.classList.remove('arrastando'); }); });
  zona.addEventListener('drop', function(e){ if (e.dataTransfer && e.dataTransfer.files.length && !enviando) enviar(Array.from(e.dataTransfer.files)); });
}

async function salvarDados(extra){
  var v = function(n){ var i = root.querySelector('[data-campo][name=' + n + ']'); return i ? i.value : atual[n]; };
  if (!v('cliente').trim()){ $('salvo').textContent = 'O nome da cliente não pode ficar vazio.'; return; }
  var dados = Object.assign({id:atual.id, cliente:v('cliente'), titulo:v('titulo'), data:v('data')}, extra || {});
  try {
    var id = atual.id, j = await api('salvar', dados);
    if (atual && atual.id === id) atual = j.galeria;
    var s = $('salvo'); if (s) s.textContent = 'Salvo.';
  } catch(e){ var s2 = $('salvo'); if (s2) s2.textContent = e.msg; else aviso(e.msg); }
}

function telaAjustes(){
  pagina('<div class="titulo-pg"><h1>Ajustes</h1></div><form class="caixa" id="f-ajustes" novalidate>' +
    campo('estudio', 'Seu nome ou estúdio (aparece nas galerias)', st.estudio, 'text', ' required') +
    '<h2 style="margin-top:.75rem">Trocar senha</h2><p class="sub">Deixe em branco para manter a atual.</p><div class="colunas">' +
    campo('senha_atual', 'Senha atual', '', 'password', ' autocomplete="current-password"') +
    campo('senha_nova', 'Nova senha', '', 'password', ' autocomplete="new-password"') + '</div>' +
    '<p class="erro" role="alert"></p><button class="btn cheio" type="submit">Salvar</button></form>');
  var f = $('f-ajustes');
  enviarForm(f, async function(d){
    var j = await api('ajustes', {estudio:d.get('estudio'), senha_atual:d.get('senha_atual'), senha_nova:d.get('senha_nova')});
    st.estudio = j.estudio;
    f.querySelector('[name=senha_atual]').value = ''; f.querySelector('[name=senha_nova]').value = '';
    root.querySelector('.marca').textContent = st.estudio;
    aviso('Ajustes salvos.');
  });
}

/* ---------- Ações ---------- */
root.addEventListener('click', async function(e){
  var el = e.target.closest('[data-acao]');
  if (!el) return;
  var acao = el.dataset.acao;
  if (acao === 'sair'){
    if (enviando){ aviso('Espere o envio das fotos terminar.'); return; }
    try { await api('sair'); } catch(x) {}
    atual = null; await carregarEstado(); mostrar();
  }
  else if (acao === 'escolher'){ if (!enviando) $('arquivo').click(); }
  else if (acao === 'copiar') copiar();
  else if (acao === 'whatsapp') whatsapp();
  else if (acao === 'capa'){ atual.capa = el.dataset.f; renderFotos(); salvarDados({capa:el.dataset.f}); }
  else if (acao === 'remover') remover(el.dataset.f);
  else if (acao === 'excluir') excluir(el);
});

function mensagem(){
  var nome = (atual.cliente || '').trim().split(/\s+/)[0];
  return 'Oi' + (nome ? ', ' + nome : '') + '! Suas fotos estão prontas ✨' + (atual.titulo ? '\n' + atual.titulo : '') +
    '\n\nVeja e baixe por aqui:\n' + linkGaleria(atual);
}
function whatsapp(){
  if (!atual.fotos.length) aviso('A galeria ainda está sem fotos.');
  window.open('https://wa.me/?text=' + encodeURIComponent(mensagem()), '_blank', 'noopener');
}
async function copiar(){
  var t = linkGaleria(atual);
  try { await navigator.clipboard.writeText(t); }
  catch(e){ var i = $('link'); i.select(); try { document.execCommand('copy'); } catch(x) {} }
  aviso('Link copiado.');
}

function confirmar(chave, depois){
  if (confirmando !== chave){
    confirmando = chave; depois();
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(function(){ if (confirmando === chave){ confirmando = null; depois(); } }, 3500);
    return false;
  }
  confirmando = null;
  return true;
}

async function remover(fid){
  if (enviando){ aviso('Espere o envio das fotos terminar.'); return; }
  if (!confirmar(fid, renderFotos)) return;
  try { atual = (await api('remover_foto', {id:atual.id, foto:fid})).galeria; renderFotos(); aviso('Foto removida.'); }
  catch(e){ aviso(e.msg); renderFotos(); }
}

async function excluir(btn){
  if (enviando){ aviso('Espere o envio das fotos terminar.'); return; }
  var pinta = function(){ var b = $('btn-excluir'); if (!b) return; var c = confirmando === 'galeria'; b.classList.toggle('confirmar', c); b.textContent = c ? 'Toque de novo para excluir de vez' : 'Excluir galeria'; };
  if (!confirmar('galeria', pinta)) return;
  btn.disabled = true;
  try { await api('excluir', {id:atual.id}); atual = null; aviso('Galeria excluída.'); location.hash = '#/'; }
  catch(e){ aviso(e.msg); btn.disabled = false; pinta(); }
}

/* ---------- Envio de fotos ---------- */
function carregarImg(file){
  return new Promise(function(ok, falha){
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function(){ ok(im); };
    im.onerror = function(){ URL.revokeObjectURL(url); falha({msg:'formato'}); };
    im.src = url;
  });
}
async function decodificar(file){
  try { return await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch(e) { return await carregarImg(file); }
}
function redimensionar(fonte, w, h, max, q){
  var escala = Math.min(1, max / Math.max(w, h), Math.sqrt(16000000 / (w * h)));
  var cw = Math.max(1, Math.round(w * escala)), ch = Math.max(1, Math.round(h * escala));
  var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  var ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fonte, 0, 0, cw, ch);
  return new Promise(function(ok, falha){ cv.toBlob(function(b){ cv.width = cv.height = 0; b ? ok(b) : falha({msg:'formato'}); }, 'image/jpeg', q); });
}
// A original vai como está sempre que o servidor aceita; só convertemos HEIC ou arquivos grandes demais.
async function preparar(file){
  var fonte = await decodificar(file);
  var w = fonte.width || fonte.naturalWidth, h = fonte.height || fonte.naturalHeight;
  var mini = await redimensionar(fonte, w, h, 1400, 0.82);
  var aceito = ['image/jpeg','image/png','image/webp'].indexOf(file.type) >= 0;
  var orig = file, nome = file.name || 'foto.jpg';
  if (!aceito || file.size > st.limite){
    orig = await redimensionar(fonte, w, h, 8000, 0.92);
    if (orig.size > st.limite) orig = await redimensionar(fonte, w, h, 4000, 0.88);
    nome = nome.replace(/\.[^.]+$/, '') + '.jpg';
  }
  if (fonte.close) fonte.close();
  if (fonte.src && fonte.src.indexOf('blob:') === 0) URL.revokeObjectURL(fonte.src);
  return {orig:orig, mini:mini, nome:nome, w:w, h:h};
}

async function enviar(arquivos){
  var lista = arquivos.filter(function(f){ return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
  if (!lista.length){ aviso('Escolha arquivos de imagem.'); return; }
  var id = atual.id;
  enviando = true;
  var btn = root.querySelector('[data-acao="escolher"]'); if (btn) btn.disabled = true;
  var prog = function(t){ var p = $('progresso'); if (p) p.textContent = t; };
  var falhas = 0, ultimoErro = '', feitos = 0, prox = 0, parar = false;
  prog('Enviando 0 de ' + lista.length + '… não feche esta página.');
  async function trabalhador(){
    while (prox < lista.length && !parar){
      var file = lista[prox++];
      try {
        var p = await preparar(file);
        var j = await api('enviar', {id:id, w:p.w, h:p.h, nome:p.nome}, {foto:{blob:p.orig, nome:p.nome}, mini:{blob:p.mini, nome:'mini.jpg'}});
        if (atual && atual.id === id){ atual = j.galeria; renderFotos(); }
      } catch(e) {
        falhas++;
        ultimoErro = e && e.msg === 'formato' ? 'Exporte em JPG e tente de novo.' : (e && e.msg) || '';
        if (e && (e.status === 401 || e.status === 404)) parar = true;
      }
      feitos++;
      prog('Enviando ' + feitos + ' de ' + lista.length + '… não feche esta página.');
    }
  }
  await Promise.all([trabalhador(), trabalhador()]);
  enviando = false;
  if (btn) btn.disabled = false;
  var ok = feitos - falhas;
  if (falhas){
    prog(ok + ' de ' + lista.length + ' fotos enviadas. ' + plural(falhas, 'falhou', 'falharam') + '. ' + ultimoErro);
  } else {
    prog(plural(ok, 'foto enviada', 'fotos enviadas') + '. Pode adicionar mais quando quiser.');
    aviso('Fotos enviadas.');
  }
}

/* ---------- Início ---------- */
async function carregarEstado(){
  var j = await api('estado');
  st.csrf = j.csrf; st.configurado = j.configurado; st.logado = j.logado; st.estudio = j.estudio; st.limite = j.limite;
  if (!j.gravavel) aviso('Atenção: o servidor não deixou criar as pastas de dados.', true);
}
carregarEstado().then(mostrar, function(e){
  root.innerHTML = '<div class="entrada"><p class="erro">' + esc(e.msg || 'Não foi possível abrir a área.') + '</p></div>';
});
})();
