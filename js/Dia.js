/* ============================================================
   Dia.js — SuperCopa (somente RESUMO + seletor de dia)
   ============================================================ */

/* Supabase */
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Tabelas */
const TBL_PARTIDA = "Partida";
const TBL_GOL = "Gol";
const TBL_DATA = "Data";

/* Utils */
const esc = (s = "") => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const qs = (sel, root = document) => root.querySelector(sel);
function parseQueryParams() { const p = new URLSearchParams(location.search); const n = Number(p.get("n") || p.get("dia") || NaN); return { n: Number.isFinite(n) ? n : null }; }
function setQueryParam(n) { const url = new URL(location.href); url.searchParams.set("n", n); history.replaceState(null, "", url); }

/* Bolinhas */
const TEAM_COLORS = { amarelo: "#f3c614", azul: "#2563eb", branco: "#ffffff", preto: "#0f172a" };
const teamKey = n => String(n || "").trim().toLowerCase();
const teamDot = t => `<span class="team-dot" style="background:${TEAM_COLORS[teamKey(t)] || "#9ca3af"}"></span>`;

/* ---------- Seletor de dia: busca todas as Datas ---------- */
async function getAvailableDays() {
    // Tabela "Data" é a fonte da verdade
    const { data, error } = await db.from(TBL_DATA).select("Numero").order("Numero", { ascending: true });
    if (!error && data?.length) {
        return data.map(r => Number(r.Numero)).filter(Number.isFinite);
    }
    // Fallback: extrai de Partida (D{n}-...)
    const { data: part, error: err2 } = await db.from(TBL_PARTIDA).select("Identificador");
    if (err2) { console.error(err2); return [1]; }
    const set = new Set();
    (part || []).forEach(r => { const m = /D(\d+)-/.exec(r.Identificador || ""); if (m) set.add(+m[1]); });
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [1];
}
function populateDaySelect(days, current) {
    const sel = qs("#dia-select");
    sel.innerHTML = days.map(d => `<option value="${d}" ${d === current ? "selected" : ""}>${d}</option>`).join("");
}

/* ---------- Dados do dia / resumo ---------- */
async function loadPartidasDia(n) {
    const { data, error } = await db.from(TBL_PARTIDA)
        .select("Identificador, Time1, Time2, GolsTime1, GolsTime2, Tipo, FoiProsPenaltis, PenaltisTime1, PenaltisTime2")
        .like("Identificador", `D${n}-%`);
    if (error) throw error;
    return {
        FG: (data || []).filter(p => p.Tipo === "FG").sort((a, b) => a.Identificador.localeCompare(b.Identificador)),
        MM: (data || []).filter(p => p.Tipo !== "FG").sort((a, b) => a.Identificador.localeCompare(b.Identificador)),
    };
}
async function loadGolsByPartida(ids) {
    if (!ids.length) return {};
    const { data, error } = await db.from(TBL_GOL)
        .select("Partida, Jogador, Goleiro, Time, TimeAdversario, Penalti")
        .in("Partida", ids);
    if (error) throw error;
    const map = {};
    (data || []).forEach(g => { (map[g.Partida] ||= []).push(g); });
    return map;
}

function splitScorers(partida, gols) {
  const t1 = partida.Time1, t2 = partida.Time2;
  const A = [], B = [];

  (gols || []).forEach(g => {
    const lado =
      (g.Time === t1 || g.TimeAdversario === t2) ? "A" :
      (g.Time === t2 || g.TimeAdversario === t1) ? "B" : null;
    if (!lado) return;
    const item = { nome: g.Jogador, p: !!g.Penalti };
    if (lado === "A") A.push(item); else B.push(item);
  });

  const pack = (list) => {
    const agg = {};
    list.forEach(({ nome, p }) => {
      if (!nome) return;
      const key = String(nome);
      if (!agg[key]) agg[key] = { normal: 0, pen: 0 };
      if (p) agg[key].pen += 1;
      else agg[key].normal += 1;
    });

    const tokens = [];
    Object.entries(agg).forEach(([nome, c]) => {
      const safe = (typeof esc === 'function') ? esc(nome) : String(nome);
      // Normais agregados (1 => "Nome"; >1 => "Nome (N)")
      if (c.normal > 0) tokens.push(c.normal === 1 ? safe : `${safe} (${c.normal})`);
      // Pênaltis *separados*, um token por gol
      for (let i = 0; i < c.pen; i++) tokens.push(`${safe} (P)`);
    });
    return tokens;
  };

  return { A: pack(A), B: pack(B) };
}



/* ---------- Tabela FG (PTS 3-1-0 + bônus do dia) ---------- */
function computeFgTable(matches) {
    const T = {}; const team = n => (T[n] ||= { time: n, gp: 0, gc: 0, v: 0, e: 0, d: 0, j: 0, pts: 0 });
    matches.forEach(p => {
        const g1 = Number(p.GolsTime1), g2 = Number(p.GolsTime2);
        if (!Number.isFinite(g1) || !Number.isFinite(g2)) return;
        const A = team(p.Time1), B = team(p.Time2);
        A.gp += g1; A.gc += g2; A.j++;
        B.gp += g2; B.gc += g1; B.j++;
        if (g1 > g2) { A.v++; A.pts += 3; B.d++; }
        else if (g2 > g1) { B.v++; B.pts += 3; A.d++; }
        else { A.e++; B.e++; A.pts += 1; B.pts += 1; }
    });
    const arr = Object.values(T).map(r => ({ ...r, sg: r.gp - r.gc }));

    function h2h(a, b) {
        const id = matches.find(m => (m.Time1 === a.time && m.Time2 === b.time) || (m.Time1 === b.time && m.Time2 === a.time));
        if (!id) return 0;
        const g1 = +id.GolsTime1, g2 = +id.GolsTime2; if (!Number.isFinite(g1) || !Number.isFinite(g2)) return 0;
        if (id.Time1 === a.time) return g1 > g2 ? 1 : g2 > g1 ? -1 : 0; else return g2 > g1 ? 1 : g1 > g2 ? -1 : 0;
    }
    arr.sort((a, b) => (b.pts - a.pts) || (b.sg - a.sg) || (b.gp - a.gp) || (-h2h(a, b)) || a.time.localeCompare(b.time));

    const FG_POINTS = [3, 2, 1, 0];
    arr.forEach((r, i) => r.ptsDiaFG = FG_POINTS[i] ?? 0);
    return arr;
}
function renderFgTable(container, table) {
    const el = qs(`#${container}`);
    el.innerHTML = `
    <div class="row header"><div>Time</div><div>PTS</div><div>SG</div><div>Gols</div></div>
    ${table.map(r => `
      <div class="row item">
        <div class="teamcell">${teamDot(r.time)} ${esc(r.time)}</div>
        <div>${r.pts}</div>
        <div>${r.sg}</div>
        <div>${r.gp}</div>
        <div class="green">+${r.ptsDiaFG}</div>
      </div>`).join("")}
  `;
}

/* ---------- Partidas (fancy cards) ---------- */
function renderFgMatches(container, matches, golsMap) {
    const el = qs(`#${container}`); el.innerHTML = "";
    matches.forEach(p => {
        const s = splitScorers(p, golsMap[p.Identificador] || []);
        const g1 = Number.isFinite(+p.GolsTime1) ? +p.GolsTime1 : "–";
        const g2 = Number.isFinite(+p.GolsTime2) ? +p.GolsTime2 : "–";

        el.insertAdjacentHTML("beforeend", `
      <div class="match-line-fancy cardish">
        <div class="dot dot-a">${teamDot(p.Time1)}</div>
        <div class="score-fancy">
          <span class="ga">${g1}</span><span class="sep">×</span><span class="gb">${g2}</span>
        </div>
        <div class="dot dot-b">${teamDot(p.Time2)}</div>

        <div class="scorers-left">${s.A.join(", ") || "&nbsp;"}</div>
        <div class="scorers-right">${s.B.join(", ") || "&nbsp;"}</div>
      </div>
    `);
    });
}

function renderMmMatches(container, matches, golsMap) {
    const el = qs(`#${container}`); el.innerHTML = "";

    const isSemi = p => /(semi)/i.test(p.Tipo || "") || /S\d$/i.test(p.Identificador);
    const isDT = p => /(disputa.*terceiro|terce)/i.test(p.Tipo || "") || /-DT$/i.test(p.Identificador);
    const isFinal = p => /(final)$/i.test(p.Tipo || "") || /-F$/i.test(p.Identificador);

    const semis = matches.filter(isSemi).sort((a, b) => a.Identificador.localeCompare(b.Identificador));
    const terceiro = matches.filter(isDT).sort((a, b) => a.Identificador.localeCompare(b.Identificador));
    const final = matches.filter(isFinal).sort((a, b) => a.Identificador.localeCompare(b.Identificador));

    const section = (titulo, games) => {
        if (!games.length) return "";
        const lines = games.map(p => {
            const s = splitScorers(p, golsMap[p.Identificador] || []);
            const g1 = Number.isFinite(+p.GolsTime1) ? +p.GolsTime1 : "–";
            const g2 = Number.isFinite(+p.GolsTime2) ? +p.GolsTime2 : "–";
            const pens = p.FoiProsPenaltis
                ? `<div class="pen-box">
              <span class="ga">( ${p.PenaltisTime1 ?? 0} )</span><span class="sep">×</span><span class="gb">( ${p.PenaltisTime2 ?? 0} )</span>
          </div>`
                : "";
            return `
        <div class="match-line-fancy cardish ${p.FoiProsPenaltis ? 'has-pens' : ''}">
          <div class="dot dot-a">${teamDot(p.Time1)}</div>
           <div class="score-fancy">
             <div class="score-line">
               <span class="ga">${g1}</span><span class="sep">×</span><span class="gb">${g2}</span>
             </div>
             ${pens}
           </div>
          <div class="dot dot-b">${teamDot(p.Time2)}</div>

          <div class="scorers-left">${s.A.join(", ") || "&nbsp;"}</div>
          <div class="scorers-right">${s.B.join(", ") || "&nbsp;"}</div>
        </div>
      `;
        }).join("");
        return `<div class="section">
      <div class="section-title big">${titulo}</div>
      ${lines}
    </div>`;
    };

    el.innerHTML = [
        section("Semi-finais", semis),
        section("Disputa de 3º", terceiro),
        section("Final", final)
    ].join("");
}

/* ---------- Pódio ---------- */
function computeDayPodium(mm) {
    const win = p => {
        if (+p.GolsTime1 !== +p.GolsTime2) return +p.GolsTime1 > +p.GolsTime2 ? p.Time1 : p.Time2;
        if (p.FoiProsPenaltis) return (+p.PenaltisTime1 >= +p.PenaltisTime2) ? p.Time1 : p.Time2;
        return p.Time1; // fallback neutro
    };
    const lose = p => (win(p) === p.Time1 ? p.Time2 : p.Time1);

    const s1 = mm.find(m => /S1$/.test(m.Identificador));
    const s2 = mm.find(m => /S2$/.test(m.Identificador));
    const dt = mm.find(m => /-DT$/.test(m.Identificador));
    const f = mm.find(m => /-F$/.test(m.Identificador));
    if (!s1 || !s2 || !dt || !f) return null;
    return [
        { pos: 1, time: win(f), pts: 5 },
        { pos: 2, time: lose(f), pts: 3 },
        { pos: 3, time: win(dt), pts: 2 },
        { pos: 4, time: lose(dt), pts: 1 },
    ];
}
function renderDayPodium(container, podium) {
    const el = qs(`#${container}`);
    if (!podium) { el.innerHTML = `<div class="muted">Semifinais/final/terceiro ainda não registrados.</div>`; return; }
    el.innerHTML = podium.map(p => `
    <div class="row">
      <div><strong>${p.pos}º</strong></div>
      <div>${teamDot(p.time)} ${esc(p.time)}</div>
      <div class="green">+${p.pts}</div>
    </div>`).join("");
}

/* ---------- Orquestração ---------- */
async function renderResumoDia(n) {
    const { FG, MM } = await loadPartidasDia(n);
    const ids = [...FG, ...MM].map(p => p.Identificador);
    const golsMap = await loadGolsByPartida(ids);

    renderFgMatches("fg-matches", FG, golsMap);
    const table = computeFgTable(FG);
    renderFgTable("fg-table", table);

    renderMmMatches("mm-matches", MM, golsMap);
    const podium = computeDayPodium(MM);
    renderDayPodium("day-podium", podium);
}

/* ---------- INIT ---------- */
async function renderDay(n) {
    await renderResumoDia(n);
    setQueryParam(n);
}
async function init() {
    const days = await getAvailableDays();
    const fromURL = parseQueryParams().n;
    const current = Number.isFinite(fromURL) ? fromURL : days[days.length - 1];
    populateDaySelect(days, current);
    qs("#dia-select").addEventListener("change", e => renderDay(+e.target.value));
    await renderDay(current);
}
window.init = init;
