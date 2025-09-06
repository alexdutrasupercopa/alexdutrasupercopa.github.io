// ================== CONFIG ==================
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";
const TABLE_NAME = "Time";                              // nome exato da sua tabela
// ============================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers DOM
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const getEl = (a, b) => document.getElementById(a) || document.getElementById(b);

// Cores por nome (aceita nome CSS)
function getTeamColor(nome){
  if(!nome) return "#808080";
  const n = String(nome).trim().toLowerCase();
  const map = { amarelo:"#ffd000", azul:"#2d6cff", branco:"#e5e7eb", preto:"#111827",
                vermelho:"#ef4444", verde:"#22c55e", roxo:"#8b5cf6", laranja:"#fb923c",
                rosa:"#f472b6", cinza:"#9ca3af", fa:"#9b9b9b" };
  return map[n] || (CSS.supports("color", nome) ? nome : "#808080");
}

// Tolerante a nomes de colunas
function pick(o, keys){ for(const k of keys) if(o && k in o) return o[k]; }

function normalizeRow(row){
  return {
    nome: pick(row, ["Nome","nome","Time","time"]) || "",
    pontos: +pick(row, ["Pontos","pontos"]) || 0,
    vitorias: +pick(row, ["Vitorias","Vitórias","vitorias"]) || 0,
    saldo: +pick(row, ["SaldoGols","SaldoG","Saldo","saldo"]) || 0,
    golsPro: +pick(row, ["Gols","GolsPro","GolsMarcados","gols_pro"]) || 0,
    golsSofridos: +pick(row, ["GolsSofridos","GolsContra","gols_sofridos"]) || 0,
    primeiro: +pick(row, ["VezesPrimeiro","vezes_primeiro"]) || 0,
    segundo: +pick(row, ["VezesSegundo","vezes_segundo"]) || 0,
    posicao: pick(row, ["Posicao","Posição","posicao"]) != null ? +pick(row, ["Posicao","Posição","posicao"]) : null,
  };
}

// Desempate padrão da classificação
function tieBreak(a,b){
  if(a.pontos !== b.pontos) return b.pontos - a.pontos;
  if(a.saldo  !== b.saldo ) return b.saldo  - a.saldo;
  if(a.golsPro!== b.golsPro)return b.golsPro- a.golsPro;
  if(a.vitorias!==b.vitorias)return b.vitorias- a.vitorias;
  return (a.nome||"").localeCompare(b.nome||"");
}

// Estado
let BASE_ROWS = [];
let sort = { key: "pos", dir: "asc" }; // padrão

// Ordenação genérica (todas as colunas)
const GETTERS = {
  pos: r => r.posicao ?? 9_999, // usada quando escolher "pos"
  nome: r => (r.nome||"").toLowerCase(),
  pontos: r => r.pontos,
  vitorias: r => r.vitorias,
  saldo: r => r.saldo,
  golsPro: r => r.golsPro,
  golsSofridos: r => r.golsSofridos,
  primeiro: r => r.primeiro,
  segundo: r => r.segundo,
};

function sortRows(rows, key, dir){
  const arr = [...rows];
  const mul = dir === "desc" ? -1 : 1;

  // posição salva tem regra especial
  if(key === "pos"){
    arr.sort((a,b)=>{
      const pa = GETTERS.pos(a), pb = GETTERS.pos(b);
      if(pa !== pb) return (pa - pb) * mul;
      return tieBreak(a,b);
    });
    return arr;
  }

  const g = GETTERS[key] || GETTERS.pontos;
  arr.sort((a,b)=>{
    const av = g(a), bv = g(b);
    // tipos diferentes (string vs número)
    if(typeof av === "string" || typeof bv === "string"){
      return av.localeCompare(bv) * mul || tieBreak(a,b);
}
    if(av < bv) return -1 * mul;
    if(av > bv) return  1 * mul;
    return tieBreak(a,b);
  });
  return arr;
}

// Constrói a célula de time (bolinha + texto)
function teamCell(nome){
  return `
    <div class="jogador-cell">
      <div class="time-dot" style="width:28px;height:28px;border-radius:50%;background:${getTeamColor(nome)};
           border:2px solid rgba(0,0,0,.08);box-shadow:inset 0 0 0 2px rgba(0,0,0,.06)"></div>
      <div class="jogador-info">
        <div class="jogador-nome" title="${nome||""}">${nome||"-"}</div>
        <div class="jogador-sub">Time</div>
      </div>
    </div>`;
}

function render(view){
  const body = $("#tabela-body");
  body.innerHTML = "";

  if(!view.length){
    body.innerHTML = `<div class="tabela-row"><div class="col span-all" style="justify-content:center;color:#777;">Sem dados cadastrados.</div></div>`;
    return;
  }

  // posição exibida: se key=pos, mostra posicao salva; senão, indice da view
  view.forEach((r,i)=>{ r._rank = (sort.key==="pos" && r.posicao!=null) ? r.posicao : (i+1); });

  for(const r of view){
    const row = document.createElement("div");
    row.className = "tabela-row tabela-times-row";
    row.innerHTML = `
        <div class="col col-pos" style="justify-content:center">${r._rank}</div>
        <div class="col col-time">${teamCell(r.nome)}</div>
        <div class="col center">${r.pontos}</div>
        <div class="col center"><span class="pill">${r.primeiro}</span></div>
        <div class="col center"><span class="pill">${r.segundo}</span></div>
        <div class="col center">${r.vitorias}</div>
        <div class="col center">${r.saldo}</div>
        <div class="col center">${r.golsPro}</div>
        <div class="col center">${r.golsSofridos}</div>
    `;

    body.appendChild(row);
  }
}

// Aplica busca + ordenação
function applyUI(){
  const q = (getEl("tab-busca","busca")?.value || "").toLowerCase().trim();

  let view = BASE_ROWS.filter(r => !q || (r.nome||"").toLowerCase().includes(q));
  view = sortRows(view, sort.key, sort.dir);
  render(view);

  // atualizar select conforme estado atual
  const sel = getEl("tab-ordenar","ordenar");
  if(sel){
    const maybe = `${sort.key}-${sort.dir}`;
    if([...sel.options].some(o => o.value === maybe)) sel.value = maybe;
  }
  setHeaderArrows();
}

// Setinhas no cabeçalho (usa seu CSS .asc/.desc)
function setHeaderArrows(){
  const head = $(".tabela-times-head") || $(".tabela-head");
  if(!head) return;
  $$(".th", head).forEach(th => {
    th.classList.remove("asc","desc");
    const key = th.getAttribute("data-sort");
    if(key === sort.key) th.classList.add(sort.dir);
  });
}

// Eventos
function wire(){
  const search = getEl("tab-busca","busca");
  const sel    = getEl("tab-ordenar","ordenar");
  const clear  = getEl("tab-limpar","limpar");

  if(search){
    let t; search.addEventListener("input", ()=>{ clearTimeout(t); t=setTimeout(applyUI,120); });
  }

  if(sel){
    sel.addEventListener("change", ()=>{
      const [key, dir] = sel.value.split("-");
      sort = { key, dir };
      applyUI();
    });
  }

  if(clear){
    clear.addEventListener("click", ()=>{
      if(search) search.value = "";
      if(sel) sel.value = "pos-asc";
      sort = { key:"pos", dir:"asc" };
      applyUI();
    });
  }

  // clique em qualquer cabeçalho data-sort (todas as colunas são botões .th)
  const head = $(".tabela-times-head") || $(".tabela-head");
  if(head){
    head.addEventListener("click", (e)=>{
      const btn = e.target.closest(".th[data-sort]");
      if(!btn) return;
      const key = btn.getAttribute("data-sort");
      if(sort.key === key){
        sort.dir = (sort.dir === "asc") ? "desc" : "asc";
      }else{
        sort.key = key;
        // padrão: pos asc, nome asc; demais desc
        sort.dir = (key === "pos" || key === "nome") ? "asc" : "desc";
      }
      applyUI();
    });
  }
}

// Dados
async function load(){
  const body = $("#tabela-body");
  if(body){
  body.innerHTML = `
    <div class="tabela-row tabela-row-ghost"></div>
    <div class="tabela-row tabela-row-ghost"></div>
      <div class="tabela-row tabela-row-ghost"></div>`;
  }

  const { data, error } = await supabase.from(TABLE_NAME).select("*");
  if(error){
    console.error(error);
    if(body) body.innerHTML = `<div class="tabela-row"><div class="col span-all" style="justify-content:center;color:#b33;">Erro ao carregar: ${error.message}</div></div>`;
    return;
  }

  BASE_ROWS = (data||[]).map(normalizeRow);
  applyUI();
}

document.addEventListener("DOMContentLoaded", ()=>{ wire(); load(); });
