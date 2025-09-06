// ======================= CONFIG =======================
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";   // <- troque

// Tabelas principais
const TBL_DATA      = "Data";
const TBL_FG        = "FaseGrupos";   // Numero, Data, Jogos (ARRAY text)
const TBL_PARTIDA   = "Partida";      // Identificador (PK), Time1, Time2, GolsTime1, GolsTime2, Tipo
const TBL_TIMES     = "Time";        // fonte dos 4 times

// Campos usados em Data (ajuste se necessário)
const F = {
  numero:    "Numero",
  final:     "Final",
  dia:       "Dia",
  hora:      "Hora",
  local:     "Local",
  primeiro:  "Primeiro",
  segundo:   "Segundo",
  terceiro:  "Terceiro",
  quarto:    "Quarto",
  concluida: "Concluida",
};

const DEBUG = false;
// ======================================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $  = (s, c=document) => c.querySelector(s);

// ---------- Utils ----------
function fmtDate(v) {
  try {
    const d = new Date(v);
    if (isNaN(d)) return v || "-";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return v || "-"; }
}
function fmtTime(v) {
  if (!v) return "-";
  const t = String(v).slice(0, 8);
  return t.length >= 5 ? t.slice(0, 5) : v;
}
function badge(text, type="info"){
  const colors = {
    info:   { bg:"#eef3ff", fg:"#1b4b9b", br:"#cfe0ff" },
    ok:     { bg:"#e9f9ec", fg:"#208a3c", br:"#cce8d4" },
    bad:    { bg:"#ffefef", fg:"#c23b3b", br:"#f2c9c9" },
    final:  { bg:"#fff3d6", fg:"#8a5a00", br:"#ffe2a3" }
  };
  const c = colors[type] || colors.info;
  return `<span class="pill" style="background:${c.bg};color:${c.fg};border-color:${c.br}">${text}</span>`;
}
function getQuery() {
  const url = new URL(location.href);
  const qFinal = (url.searchParams.get("final") || "").toLowerCase();
  if (["1","true","final"].includes(qFinal)) return { n:null, final:true };
  const qn = url.searchParams.get("n");
  if (qn && !Number.isNaN(Number(qn))) return { n:Number(qn), final:false };
  return { n:1, final:false }; // fallback
}

// ---------- DATA ----------
async function fetchDataByNumero(n) {
  return await supabase.from(TBL_DATA).select("*").eq(F.numero, Number(n)).maybeSingle();
}
async function fetchFinal() {
  return await supabase.from(TBL_DATA).select("*").eq(F.final, true).limit(1).maybeSingle();
}
async function fetchPrimeiraData() {
  const { data, error } = await supabase.from(TBL_DATA).select("*").order(F.numero, { ascending:true }).limit(1);
  return { data: data && data[0], error };
}
async function loadData({ n, final }) {
  if (final) {
    const res = await fetchFinal();
    if (res.error) throw res.error;
    if (res.data) return { row: res.data, source: "final" };
  } else {
    const res = await fetchDataByNumero(n);
    if (res.error) throw res.error;
    if (res.data) return { row: res.data, source: "numero" };
  }
  const fb = await fetchPrimeiraData();
  if (fb.error) throw fb.error;
  if (fb.data) return { row: fb.data, source: "fallback" };
  return { row:null, source:"empty" };
}

// ---------- MATA-MATA (listagem simples, igual antes) ----------
const FK_TO_DATA = ["Data"];

async function loadMatches(table, dataNumero){
  for(const fk of FK_TO_DATA){
    const { data, error } = await supabase.from(table).select("*").eq(fk, dataNumero);
    if (!error && Array.isArray(data)) return data;
  }
  return [];
}
function normMatch(r){
  const a  = r.TimeA ?? r.timeA ?? r.A ?? r.Casa ?? r.Mandante ?? "-";
  const b  = r.TimeB ?? r.timeB ?? r.B ?? r.Fora ?? r.Visitante ?? "-";
  const ga = Number(r.GolsA ?? r.golsA ?? r.PlacarA ?? r.gA ?? "");
  const gb = Number(r.GolsB ?? r.golsB ?? r.PlacarB ?? r.gB ?? "");
  const score = (Number.isFinite(ga) && Number.isFinite(gb)) ? `${ga} × ${gb}` : "–";
  const done = Number.isFinite(ga) && Number.isFinite(gb);
  return { a, b, score, done };
}
function renderMatchList(containerId, rows){
  const body = $(containerId);
  body.innerHTML = "";
  if(!rows.length){
    body.innerHTML = `<div class="tabela-row"><div class="col span-all" style="justify-content:center;color:#777;">Sem partidas cadastradas.</div></div>`;
    return;
  }
  rows.map(normMatch).forEach(m=>{
    const r = document.createElement("div");
    r.className = "tabela-row";
    r.innerHTML = `
      <div class="col"><strong>${m.a}</strong> vs <strong>${m.b}</strong></div>
      <div class="col center"><span class="kpi">${m.score}</span></div>
      <div class="col center">${m.done ? badge("Concluída","ok") : badge("Agendada","info")}</div>
    `;
    body.appendChild(r);
  });
}

// ---------- FAIXA "INFORMAÇÕES DO DIA" ----------
function renderDataCard(d, source){
  const titulo = $("#dia-titulo");
  const body = $("#data-body");

  titulo.textContent = d[F.final] ? "Final" : `Dia ${d[F.numero] ?? ""}`;
  body.innerHTML = "";

  const row = document.createElement("div");
  row.className = "tabela-row";
  row.innerHTML = `
    <div class="col">
      <div class="jogador-cell">
        <div class="time-dot" style="width:18px;height:18px;border-radius:50%;background:#9ca3af;border:2px solid rgba(0,0,0,.06)"></div>
        <div class="jogador-info">
          <div class="jogador-nome" style="font-size:1rem">
            ${d[F.final] ? "Final" : `Data ${d[F.numero]}`}
            ${d[F.final] ? badge("FINAL","final") : ""}
          </div>
          <div class="jogador-sub">
            ${d[F.local] ? `Local: ${d[F.local]} • ` : ""}${d[F.dia] ? fmtDate(d[F.dia]) : "-"} ${d[F.hora] ? `às ${fmtTime(d[F.hora])}` : ""}
          </div>
        </div>
      </div>
    </div>
    <div class="col center">${d[F.concluida] ? badge("Concluída","ok") : badge("Em andamento","info")}</div>
    <div class="col center">${d[F.primeiro] ? badge(`1º: ${d[F.primeiro]}`,"ok") : ""}</div>
    <div class="col center">${d[F.segundo]  ? badge(`2º: ${d[F.segundo]}`,"info")  : ""}</div>
    <div class="col center">${d[F.terceiro] ? badge(`3º: ${d[F.terceiro]}`,"info") : ""}</div>
    <div class="col center">${d[F.quarto]   ? badge(`4º: ${d[F.quarto]}`,"info")   : ""}</div>
  `;
  body.appendChild(row);

  if (source === "fallback") {
    const note = document.createElement("div");
    note.className = "tabela-row";
    note.innerHTML = `<div class="col span-all" style="justify-content:center;color:#8b5e00">Mostrando a primeira Data disponível (a Data solicitada não foi encontrada).</div>`;
    body.appendChild(note);
  }
}

// =====================================================
//            FASE DE GRUPOS — novo esquema
// =====================================================

// 1) Buscar automaticamente os 4 times (exclui "FA")
async function getFourTeamsFromDB(){
  const { data, error } = await supabase.from(TBL_TIMES).select("*");
  if (error) throw error;
  const nomes = (data || [])
    .map(r => r.Nome ?? r.nome ?? r.Time ?? r.time)
    .filter(n => n && String(n).toLowerCase() !== "fa");
  const unique = Array.from(new Set(nomes));
  if (unique.length !== 4) throw new Error(`Foram encontrados ${unique.length} times válidos (excluindo FA); precisamos de 4.`);
  unique.sort((a,b)=> String(a).localeCompare(String(b)));
  return unique; // [T1,T2,T3,T4]
}

// 2) Ler registro de FaseGrupos do dia n
async function fetchFaseGrupos(n){
  return await supabase.from(TBL_FG).select("*").eq("Numero", Number(n)).maybeSingle();
}

// cria 6 partidas D{n}-FG{1..6} e garante FaseGrupos.Numero=n
async function createFGMatchesIfNeeded(n, teams){
  console.log("[teams", teams);
  const ids = Array.from({length:6}, (_,i)=> `D${n}-FG${i+1}`);
  const comb = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(([a,b]) => ({ A:teams[a], B:teams[b] }));

  // 1) Garante o registro em FaseGrupos (Numero como PK/único)
  {
    const { error } = await supabase
      .from(TBL_FG)
      .upsert({ Numero: Number(n), Data: Number(n) }, { onConflict: "Numero" });
    if (error) throw error;
  }

  // 2) Upsert das Partidas (precisa de UNIQUE em Identificador)
  {
    const partidas = comb.map((m, i) => ({
      Identificador: ids[i],
      Time1: m.A,
      Time2: m.B,
      GolsTime1: null,
      GolsTime2: null,
      Tipo: "FG"
    }));

    const { error } = await supabase
      .from(TBL_PARTIDA)
      .upsert(partidas, { onConflict: "Identificador" });
    if (error) throw error;
  }

  // 3) Atualiza o array Jogos na FaseGrupos
  {
    const { error } = await supabase
      .from(TBL_FG)
      .update({ Jogos: ids })
      .eq("Numero", Number(n));
    if (error) throw error;
  }

  return ids;
}

// 4) Carregar as partidas da Fase de Grupos a partir de FaseGrupos.Jogos
async function getFGMatchesForDay(n){
  const { data: fgRow, error } = await fetchFaseGrupos(n);
  if (error) throw error;

  const ids = (fgRow && Array.isArray(fgRow.Jogos)) ? fgRow.Jogos : [];
  if (!ids.length) return { ids: [], matches: [] };

  // busca as partidas e reordena no mesmo order do array
  const { data: parts, error: err2 } = await supabase.from(TBL_PARTIDA).select("*").in("Identificador", ids);
  if (err2) throw err2;

  const byId = Object.fromEntries((parts || []).map(p => [p.Identificador, p]));
  const ordered = ids.map(id => byId[id]).filter(Boolean);
  return { ids, matches: ordered };
}

// 5) Renderizar edição (Partida)
function renderGroupsEditableFG(matches, n){
  const body = document.getElementById("grupos-body");
  body.innerHTML = "";

  for(const p of matches){
    const id  = p.Identificador;
    const t1  = p.Time1 || "";
    const t2  = p.Time2 || "";
    const g1  = (p.GolsTime1 ?? "");
    const g2  = (p.GolsTime2 ?? "");
    const done = Number.isFinite(Number(g1)) && Number.isFinite(Number(g2));

    const row = document.createElement("div");
    row.className = "tabela-row";
    row.dataset.id = id;

    row.innerHTML = `
      <div class="col">
        <div class="match-teams">
          <input class="in-team in-a" value="${t1}" placeholder="Time 1" />
          <span class="vs">vs</span>
          <input class="in-team in-b" value="${t2}" placeholder="Time 2" />
        </div>
      </div>

      <div class="col center">
        <div class="match-score">
          <input class="in-score in-ga" type="number" min="0" inputmode="numeric" value="${g1 === null ? "" : g1}" />
          <span class="x">×</span>
          <input class="in-score in-gb" type="number" min="0" inputmode="numeric" value="${g2 === null ? "" : g2}" />
        </div>
      </div>

      <div class="col center">${done ? badge("Concluída","ok") : badge("Agendada","info")}</div>

      <div class="col center">
        <button class="btn-save-linha">Salvar</button>
      </div>
    `;

    row.querySelector(".btn-save-linha").addEventListener("click", async ()=>{
      const payload = {
        Identificador: id,
        Time1: row.querySelector(".in-a").value.trim(),
        Time2: row.querySelector(".in-b").value.trim(),
        GolsTime1: row.querySelector(".in-ga").value === "" ? null : Number(row.querySelector(".in-ga").value),
        GolsTime2: row.querySelector(".in-gb").value === "" ? null : Number(row.querySelector(".in-gb").value),
        Tipo: "FG"
      };
      try{
        const { error } = await supabase.from(TBL_PARTIDA).upsert(payload);
        if (error) throw error;
        toastRowOk(row);
        // atualiza badge de status
        const s1 = payload.GolsTime1, s2 = payload.GolsTime2;
        row.querySelector(".col:nth-child(3)").innerHTML = (s1!=null && s2!=null) ? badge("Concluída","ok") : badge("Agendada","info");
      }catch(e){
        console.error(e);
        toastRowErr(row);
      }
    });

    body.appendChild(row);
  }

  // Salvar tudo
  const saveAll = document.getElementById("grp-salvar-tudo");
  if (saveAll){
    saveAll.onclick = async ()=>{
      const rows = Array.from(body.querySelectorAll(".tabela-row"));
      const payload = rows.map(r => ({
        Identificador: r.dataset.id,
        Time1: r.querySelector(".in-a").value.trim(),
        Time2: r.querySelector(".in-b").value.trim(),
        GolsTime1: r.querySelector(".in-ga").value === "" ? null : Number(r.querySelector(".in-ga").value),
        GolsTime2: r.querySelector(".in-gb").value === "" ? null : Number(r.querySelector(".in-gb").value),
        Tipo: "FG"
      }));
      try{
        const { error } = await supabase.from(TBL_PARTIDA).upsert(payload);
        if (error) throw error;
        rows.forEach(toastRowOk);
      }catch(e){
        console.error(e);
        rows.forEach(toastRowErr);
      }
    };
  }
}

// feedback visual na linha ao salvar
function toastRowOk(row){
  row.style.boxShadow = "0 0 0 2px rgba(34,197,94,.35) inset";
  setTimeout(()=> row.style.boxShadow = "", 800);
}
function toastRowErr(row){
  row.style.boxShadow = "0 0 0 2px rgba(239,68,68,.35) inset";
  setTimeout(()=> row.style.boxShadow = "", 1200);
}

// 6) Fluxo principal da Fase de Grupos (novo esquema com ARRAY de jogos)
async function initFaseGrupos(n){
  const setup = document.getElementById("grupos-setup");
  const body  = document.getElementById("grupos-body");
  if (!setup || !body) return;

  // tenta ler FaseGrupos e jogos já vinculados
  let { data: fgRow, error } = await fetchFaseGrupos(n);
  if (error) console.error("[FG] fetchFaseGrupos", error);

  let ids = [];
  let matches = [];
  if (fgRow && Array.isArray(fgRow.Jogos) && fgRow.Jogos.length) {
    const res = await getFGMatchesForDay(n);
    ids = res.ids;
    matches = res.matches;
  }

  if (!matches.length) {
    setup.style.display = "";
    const btn = document.getElementById("grp-gerar");
    console.log('1');    
    if (btn) {
      btn.onclick = async ()=>{
        try{
          const teams = await getFourTeamsFromDB();
          console.log("[FG] Times:", teams);
          const created = await createFGMatchesIfNeeded(n, teams);
          console.log("[FG] Criados:", created);
          const res = await getFGMatchesForDay(n);
          matches = res.matches;
          setup.style.display = "none";
          renderGroupsEditableFG(matches, n);
        }catch(e){
          console.error("[FG] Erro ao gerar:", e);
          alert(e.message || "Não foi possível gerar as partidas. Verifique permissões e índices.");
        }
      };
    }

    body.innerHTML = `<div class="tabela-row"><div class="col span-all muted">
      Sem partidas cadastradas. Clique em <strong>Gerar partidas</strong> para criar as 6 partidas (D${n}-FG1..FG6).
    </div></div>`;
  } else {
    setup.style.display = "none";
    renderGroupsEditableFG(matches, n);
  }
}

// ======================= INIT (página) =======================
async function init(){
  console.log('Teste');
    
  // placeholders só quando os contêineres existem
  const dataBody   = document.getElementById("data-body");
  const gruposBody = document.getElementById("grupos-body");
  const mataBody   = document.getElementById("mata-body");

  if (dataBody)   dataBody.innerHTML   = `<div class="tabela-row tabela-row-ghost"></div>`;
  if (gruposBody) gruposBody.innerHTML = `<div class="tabela-row tabela-row-ghost"></div>`;
  if (mataBody)   mataBody.innerHTML   = `<div class="tabela-row tabela-row-ghost"></div>`;

  try{
    const query = getQuery();
    const { row, source } = await loadData(query);

    if (!row) {
      if (document.getElementById("dia-titulo")) document.getElementById("dia-titulo").textContent = "Dia";
      if (dataBody) dataBody.innerHTML = `<div class="tabela-row"><div class="col span-all" style="justify-content:center;color:#b33;">Nenhuma Data cadastrada.</div></div>`;
      return;
    }

    renderDataCard(row, source);

    const numero = row[F.numero];
    if (numero != null) {
      // Fase de grupos (só se a seção existir nesta página)
      if (gruposBody) await initFaseGrupos(numero);

      // Mata-mata (listagem simples) — só se a seção existir
      if (mataBody) {
        const mm = await loadMatches("MataMata", numero);
        renderMatchList("#mata-body", mm);
      }
    } else {
      if (gruposBody) gruposBody.innerHTML = `<div class="tabela-row"><div class="col span-all muted">Sem número de Data.</div></div>`;
      if (mataBody)   mataBody.innerHTML   = `<div class="tabela-row"><div class="col span-all muted">Sem número de Data.</div></div>`;
    }
  }catch(err){
    console.error(err);
    if (dataBody) {
      dataBody.innerHTML = `<div class="tabela-row"><div class="col span-all" style="justify-content:center;color:#b33;">Erro ao carregar: ${err.message}</div></div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
