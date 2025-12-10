/* ---------------- Supabase config ---------------- */
const SUPABASE_URL = "https://xuxhiqxfjsfxssirrhjz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eGhpcXhmanNmeHNzaXJyaGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODM2MDgsImV4cCI6MjA3OTc1OTYwOH0.8uIANy5mpPkTEGez1Db-9AFrOdOi_Vx_p7D1b5UgCmo";

let supabaseClient = null;

/* ---------------- Utils ---------------- */
function getById(id) { return document.getElementById(id) || null; }
function safeText(s) { return (s === null || s === undefined) ? "" : String(s); }
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------------- Helper: esperar Supabase ---------------- */
async function waitForSupabase(maxAttempts = 20, intervalMs = 100) {
  let attempts = 0;
  return new Promise(resolve => {
    const check = () => {
      attempts++;
      if (typeof window.supabase !== "undefined") return resolve(true);
      if (attempts >= maxAttempts) return resolve(false);
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/* ---------------- Carregar TEXTO ESPECIAL na Home ---------------- */
async function carregarTextoHome() {
  try {
    const box = getById("homeMessage");
    if (!box) return;

    if (!supabaseClient) {
      box.innerHTML = "";
      return;
    }

    const { data, error } = await supabaseClient
      .from("posts_blog")
      .select("*")
      .eq("titulo", "LIVRARIA_CONSTRUTIVA")
      .limit(1);

    if (error) {
      box.innerHTML = "<p style='color:#c0392b'>Erro ao carregar conteúdo.</p>";
      return;
    }

    box.innerHTML = (data && data.length > 0) ? (data[0].conteudo || "") : "";

  } catch (err) {
    console.error("Erro inesperado em carregarTextoHome():", err);
  }
}

/* ---------------- Navegação ---------------- */
function mostrarSecao(secao) {
  // só mexe nas sections que fazem parte da navegação
  const navegaSections = document.querySelectorAll('section[data-nav]');
  
  navegaSections.forEach(s => {
    s.style.display = (s.id === secao) ? 'block' : 'none';
  });

  window.location.hash = secao;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarTopo() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirWhatsApp(msg) {
  window.open(`https://wa.me/959622160?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ---------------- Inicialização ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await waitForSupabase();
  if (ok) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (err) {
      console.error("Erro ao criar client:", err);
      supabaseClient = null;
    }
  }

  // mostrar seção inicial (somente das que têm data-nav)
  const hash = window.location.hash.replace("#", "");
  const alvo = document.getElementById(hash);

  if (alvo && alvo.hasAttribute("data-nav")) {
    mostrarSecao(hash);
  }

  // carregar conteúdo da home
  await carregarTextoHome();
});

/* ---------------- Expor funções ---------------- */
window.mostrarSecao = mostrarSecao;
window.voltarTopo = voltarTopo;
window.abrirWhatsApp = abrirWhatsApp;
window.carregarTextoHome = carregarTextoHome;