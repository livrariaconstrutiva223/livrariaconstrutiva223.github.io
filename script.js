/* ------------------------------
  script.js - versão final (robusta)
  - Mantém todas as tuas funcionalidades
  - Adiciona fallback via REST para garantir INSERT/SELECT/DELETE
  - Logs melhores e mensagens amigáveis
------------------------------ */

/* Supabase */
const SUPABASE_URL = "https://xuxhiqxfjsfxssirrhjz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eGhpcXhmanNmeHNzaXJyaGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODM2MDgsImV4cCI6MjA3OTc1OTYwOH0.8uIANy5mpPkTEGez1Db-9AFrOdOi_Vx_p7D1b5UgCmo";
let supabaseClient = null;

/* Admin password (change if needed) */
const SENHA_CORRETA = "Sacassole123...?";

/* Estado global */
let pagina = 1;
let carregando = false;
let termoBusca = "";
let categoria = "";
let livroAtual = null;

/* util */
function getById(id) { return document.getElementById(id) || null; }
function safeText(s){ return (s===null||s===undefined) ? "" : String(s); }
function escapeHtml(unsafe){
  if(unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* ---------------- Helper: REST fallback for Supabase ----------------
   Use this when `supabaseClient` is not available (e.g. CDN not loaded)
   - GET: /rest/v1/posts_blog?select=*
   - POST: /rest/v1/posts_blog
   - DELETE: /rest/v1/posts_blog?id=eq.<id>
---------------------------------------------------------------------*/
async function restSelectPosts(){
  const url = `${SUPABASE_URL}/rest/v1/posts_blog?select=*`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if(!res.ok){
      const text = await res.text();
      console.error("REST select error:", res.status, text);
      throw new Error(`REST select error ${res.status}`);
    }
    const data = await res.json();
    return { data, error: null };
  } catch(err){
    return { data: null, error: err };
  }
}

async function restInsertPost(obj){
  const url = `${SUPABASE_URL}/rest/v1/posts_blog`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        // ask supabase to return the inserted row
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(obj)
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch(e){ parsed = text; }
    if(!res.ok){
      console.error("REST insert error:", res.status, parsed);
      return { data: null, error: { message: `REST insert error ${res.status}`, details: parsed } };
    }
    return { data: parsed, error: null };
  } catch(err){
    return { data: null, error: err };
  }
}

async function restDeletePost(id){
  const url = `${SUPABASE_URL}/rest/v1/posts_blog?id=eq.${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch(e){ parsed = text; }
    if(!res.ok){
      console.error("REST delete error:", res.status, parsed);
      return { data: null, error: { message: `REST delete error ${res.status}`, details: parsed } };
    }
    return { data: parsed, error: null };
  } catch(err){
    return { data: null, error: err };
  }
}

/* ---------------- Blog (Supabase) ---------------- */
async function validarSenhaBlog(){
  const senhaEl = getById('senhaBlog');
  const senhaArea = getById('senhaArea');
  const editor = getById('editorBlog');
  if(!senhaEl || !senhaArea || !editor){ alert("Elementos do blog não encontrados."); return; }

  if(senhaEl.value === SENHA_CORRETA){
    senhaArea.style.display = 'none';
    editor.style.display = 'block';
    await carregarPosts();
  } else {
    alert("Senha incorreta!");
  }
}

async function publicarTexto(){
  const textarea = getById('textoPublicacao');
  if(!textarea){ alert("Editor não encontrado."); return; }
  const texto = textarea.value.trim();
  if(!texto){ alert("Escreva algo antes de publicar."); return; }

  let titulo = prompt("Digite o título da publicação:");
  if(!titulo) titulo = "Sem título";
  const dataStr = new Date().toLocaleString();

  const payload = { titulo, conteudo: texto, data: dataStr };

  try {
    // se supabaseClient está disponível, usa ele (padrão)
    if(supabaseClient){
      const { data, error } = await supabaseClient
        .from('posts_blog')
        .insert([payload])
        .select(); // pede retorno (caso a library suporte)
      if(error){
        console.error("Supabase insert error:", error);
        // tentar fallback REST se for erro de cliente
        const rest = await restInsertPost(payload);
        if(rest.error){
          console.error("Fallback REST insert error:", rest.error);
          alert("Erro ao publicar: " + (error.message || JSON.stringify(error)));
          return;
        } else {
          textarea.value = "";
          await carregarPosts();
          alert("Publicação criada com sucesso (via fallback).");
          return;
        }
      } else {
        textarea.value = "";
        await carregarPosts();
        alert("Publicação criada com sucesso.");
        return;
      }
    } else {
      // fallback via REST
      const rest = await restInsertPost(payload);
      if(rest.error){
        console.error("Fallback REST insert error:", rest.error);
        alert("Erro ao publicar (REST): " + (rest.error.message || JSON.stringify(rest.error)));
        return;
      } else {
        textarea.value = "";
        await carregarPosts();
        alert("Publicação criada com sucesso (via REST).");
        return;
      }
    }
  } catch (err){
    console.error("Erro inesperado ao publicar:", err);
    alert("Erro inesperado ao publicar. Veja o Console.");
  }
}

async function carregarPosts(){
  const lista = getById('listaPosts');
  if(!lista) return;
  lista.innerHTML = "<p>Carregando...</p>";

  try {
    let posts = null;
    let error = null;

    if(supabaseClient){
      const res = await supabaseClient
        .from('posts_blog')
        .select('*')
        .order('id',{ ascending:false });
      posts = res.data || null;
      error = res.error || null;
    } else {
      const rest = await restSelectPosts();
      posts = rest.data || null;
      error = rest.error || null;
    }

    if(error){
      console.error("Erro ao buscar posts:", error);
      lista.innerHTML = "<p>Erro ao carregar publicações. Veja console.</p>";
      return;
    }

    if(!posts || posts.length === 0){
      lista.innerHTML = "<p>Ainda não há publicações.</p>";
      return;
    }

    // render posts
    lista.innerHTML = "";
    posts.forEach(p => {
      const div = document.createElement('div');
      div.className = 'post';
      div.style.position = 'relative';
      div.innerHTML = `
        <h3>${escapeHtml(p.titulo)}</h3>
        <p style="white-space:pre-wrap; text-align:left;">${escapeHtml(p.conteudo)}</p>
        <small style="color:#555">${escapeHtml(p.data)}</small>
      `;

      // if editor visible, show delete button
      const editor = getById('editorBlog');
      if(editor && editor.style.display === 'block'){
        const btn = document.createElement('button');
        btn.textContent = 'Excluir';
        btn.style.position = 'absolute';
        btn.style.top = '10px';
        btn.style.right = '10px';
        btn.style.background = '#dc3545';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '4px 8px';
        btn.style.borderRadius = '6px';
        btn.addEventListener('click', ()=> excluirPost(p.id));
        div.appendChild(btn);
      }

      lista.appendChild(div);
    });

  } catch(err){
    console.error("Erro carregarPosts:", err);
    lista.innerHTML = "<p>Erro ao carregar publicações.</p>";
  }
}

async function excluirPost(id){
  if(!confirm("Tem certeza que deseja excluir este post?")) return;

  try {
    if(supabaseClient){
      const { error } = await supabaseClient
        .from('posts_blog')
        .delete()
        .eq('id', id);
      if(error){
        console.error("Erro ao apagar (supabase):", error);
        // tentar fallback REST
        const rest = await restDeletePost(id);
        if(rest.error){
          console.error("Fallback REST delete error:", rest.error);
          alert("Erro ao apagar. Veja console.");
          return;
        } else {
          await carregarPosts();
          alert("Publicação apagada (via fallback).");
          return;
        }
      } else {
        await carregarPosts();
        alert("Publicação apagada.");
        return;
      }
    } else {
      const rest = await restDeletePost(id);
      if(rest.error){
        console.error("Fallback REST delete error:", rest.error);
        alert("Erro ao apagar. Veja console.");
        return;
      } else {
        await carregarPosts();
        alert("Publicação apagada (via REST).");
        return;
      }
    }
  } catch(err){
    console.error("Erro inesperado ao apagar:", err);
    alert("Erro inesperado. Veja o console.");
  }
}

/* ---------------- Livros (Gutendex) ---------------- */
/* cria um botão de baixar seguro (sem JSON.stringify em onclick) */
function criarCardLivro(livro){
  const formatos = livro.formats || {};
  // procurar link válido
  const permitidos = [
    "application/pdf",
    "application/epub+zip",
    "text/plain",
    "text/plain; charset=utf-8",
    "application/rtf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  let link = null;
  for(const key in formatos){
    if(permitidos.includes(key)){
      link = formatos[key];
      break;
    }
  }
  if(!link) return null;

  const capa = formatos['image/jpeg'] || 'https://via.placeholder.com/150x200?text=Sem+Capa';
  const autor = (livro.authors && livro.authors.length) ? livro.authors[0].name : 'Desconhecido';

  const card = document.createElement('div');
  card.className = 'livro-card';

  const img = document.createElement('img');
  img.src = capa;
  img.alt = safeText(livro.title);

  const info = document.createElement('div');
  info.className = 'livro-info';

  const h3 = document.createElement('h3');
  h3.textContent = safeText(livro.title);

  const p = document.createElement('p');
  p.textContent = autor;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '📥 Baixar';
  // ao clicar: abrir link em nova aba. Alguns hosts permitem download via anchor; caso contrário abrir novo tab.
  btn.addEventListener('click', () => {
    try {
      const a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      let ext = '';
      try { ext = link.split('.').pop().split('?')[0]; } catch(e){}
      const filename = (safeText(livro.title).replace(/[^a-z0-9]/gi,'_') || 'download') + (ext ? '.'+ext : '');
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch(e){
      window.open(link, '_blank');
    }
    const modal = getById('modal-download');
    if(modal) modal.style.display = 'block';
  });

  info.appendChild(h3);
  info.appendChild(p);
  info.appendChild(btn);

  card.appendChild(img);
  card.appendChild(info);

  return card;
}

async function carregarLivros(){
  const container = getById('livros-container');
  const loading = getById('loading');
  const progressBar = getById('progress-bar');

  if(!container) return;
  if(carregando) return;
  carregando = true;

  if(loading){ loading.style.display = 'block'; loading.innerText = 'Carregando livros...'; }
  if(progressBar) progressBar.style.width = '25%';

  try {
    let url = `https://gutendex.com/books?languages=pt&page=${pagina}`;
    if(termoBusca) url += `&search=${encodeURIComponent(termoBusca)}`;
    if(categoria) url += `&topic=${encodeURIComponent(categoria)}`;

    const res = await fetch(url);
    if(!res.ok) throw new Error('Erro ao buscar Gutendex: ' + res.status);
    const data = await res.json();
    const livros = data.results || [];

    if(pagina === 1) container.innerHTML = '';

    livros.forEach(livro => {
      const card = criarCardLivro(livro);
      if(card) container.appendChild(card);
    });

    pagina++;
    if(progressBar) progressBar.style.width = '100%';
    setTimeout(()=>{ if(progressBar) progressBar.style.width='0'; }, 300);

    if(!data.next && loading) { loading.innerText = "Todos os livros carregados."; loading.style.display = 'block'; }
    else if(loading) loading.style.display = 'none';

  } catch(err){
    console.error("Erro carregarLivros:", err);
    if(loading) loading.innerText = "Erro ao carregar livros.";
  } finally {
    carregando = false;
  }
}

/* ---------------- UI / Navegação ---------------- */
function mostrarSecao(secao){
  const secoes = document.querySelectorAll('section');
  secoes.forEach(s => {
    if(!s.id) return;
    s.style.display = (s.id === secao) ? 'block' : 'none';
  });
  window.location.hash = secao;
  window.scrollTo({ top:0, behavior:'smooth' });

  // quando entrar em livros, reset pagina+conteudo para pesquisar do inicio
  if(secao === 'livros'){
    pagina = 1;
    const cont = getById('livros-container');
    if(cont) cont.innerHTML = '';
    carregarLivros();
  }
  if(secao === 'blog') carregarPosts();
}

function voltarTopo(){ window.scrollTo({top:0, behavior:'smooth'}); }
function fecharModal(){ const m = getById('modal-download'); if(m) m.style.display = 'none'; }
function abrirWhatsApp(mensagem){
  const numero = '959622160';
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

/* ---------------- Infinite scroll (seguro) ---------------- */
let scrollThrottle = false;
window.addEventListener('scroll', () => {
  const btnTopo = getById('btnTopo');
  if(btnTopo) btnTopo.style.display = (window.scrollY > 300) ? 'block' : 'none';

  const progressBar = getById('progress-bar');
  if(progressBar){
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if(total > 0) progressBar.style.width = `${(window.scrollY/total)*100}%`;
  }

  // só carrega mais livros quando estamos na secção livros
  const livrosSec = getById('livros');
  if(!livrosSec) return;
  const livrosVisivel = livrosSec.style.display === 'block' || window.location.hash.replace('#','') === 'livros';
  if(!livrosVisivel) return;

  if(scrollThrottle) return;
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  if(scrollTop + windowHeight + 180 >= documentHeight){
    scrollThrottle = true;
    // aguarda 300ms antes de permitir novo trigger (reduz chamadas)
    carregarLivros().finally(()=> {
      setTimeout(()=> scrollThrottle = false, 300);
    });
  }
});

/* ------------- Inicialização ------------- */
document.addEventListener('DOMContentLoaded', () => {
  // inicia supabase (precisa do CDN supabase no HTML antes deste script); se não existir, usamos REST fallback
  try {
    if(typeof supabase === 'undefined'){
      console.warn("Supabase library não encontrada. Usando fallback REST para operações de DB (insert/select/delete).");
      supabaseClient = null;
    } else {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase client inicializado.");
    }
  } catch(e){
    console.error("Erro ao inicializar supabase:", e);
    supabaseClient = null;
  }

  // listeners busca / categoria
  const buscaEl = getById('busca');
  if(buscaEl){
    buscaEl.addEventListener('input', (e)=>{
      termoBusca = e.target.value || '';
      pagina = 1;
      const cont = getById('livros-container'); if(cont) cont.innerHTML = '';
      carregarLivros();
    });
  }

  const catEl = getById('categoria');
  if(catEl){
    catEl.addEventListener('change', (e)=>{
      categoria = e.target.value || '';
      pagina = 1;
      const cont = getById('livros-container'); if(cont) cont.innerHTML = '';
      carregarLivros();
    });
  }

  // mostrar secao inicial (hash ou home)
  const hash = window.location.hash.replace('#','');
  if(hash && getById(hash)) mostrarSecao(hash);
  else mostrarSecao('home');

  // inicializações
  if(getById('listaPosts')) carregarPosts();
  if(getById('livros-container')) carregarLivros();
});

/* Expor funções para chamadas inline existentes no HTML */
window.mostrarSecao = mostrarSecao;
window.validarSenhaBlog = validarSenhaBlog;
window.publicarTexto = publicarTexto;
window.excluirPost = excluirPost;
window.voltarTopo = voltarTopo;
window.abrirWhatsApp = abrirWhatsApp;
window.fecharModal = fecharModal;
window.abrirModal = function(l){ /* placeholder — cards usam internal click handler */ console.log("abrirModal placeholder", l); };