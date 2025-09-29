// ================== CONFIG ==================
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ============================================

// ------------- Util DOM -------------
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

// ------------- Helpers de times (como no Tabela.js) -------------
function pick(o, keys){ for(const k of keys) if(o && k in o) return o[k]; }

function getTeamColor(nome){
  if(!nome) return "#808080";
  const n = String(nome).trim().toLowerCase();
  const map = {
    amarelo:"#ffd000", azul:"#2d6cff", branco:"#e5e7eb", preto:"#111827",
    vermelho:"#ef4444", verde:"#22c55e", roxo:"#8b5cf6", laranja:"#fb923c",
    rosa:"#f472b6", cinza:"#9ca3af", fa:"#9b9b9b"
  };
  return map[n] || (CSS.supports("color", nome) ? nome : "#808080");
}
function normalizeTimeRow(row){
  const nome = pick(row, ["Nome","nome","Time","time"]) || "";
  return { nome: String(nome), cor: getTeamColor(nome) };
}
function pidToIdx(pid){
  // formato: D{dia}-FG{n}
  const m = String(pid).match(/-FG(\d+)$/);
  return m ? (parseInt(m[1],10)-1) : null;
}

async function carregarPartidasExistentes(dia){
  ST.partidasExistentesById.clear();
  ST.partidasExistentesByIdx.clear();

  const prefix = `D${dia}-FG`;
  const { data: parts, error } = await db
    .from('Partida')
    .select('Identificador,GolsTime1,GolsTime2')
    .like('Identificador', `${prefix}%`)
    .order('Identificador', { ascending: true });

  if(error){ console.warn(error); return; }

  (parts||[]).forEach(p=>{
    const idx = pidToIdx(p.Identificador);
    if(idx!=null){
      const val = { g1: p.GolsTime1 ?? 0, g2: p.GolsTime2 ?? 0 };
      ST.partidasExistentesById.set(p.Identificador, val);
      ST.partidasExistentesByIdx.set(idx, val);
    }
  });
}


// ------------- Estado -------------
const ST = {
  dia: null,
  times: [],           // exatamente 4 (exclui FA)
  confrontos: [],      // 6 jogos
  golsPorPartida: {},  // idx -> [{side, jogador, goleiro, penalti}]
  partidasSalvas: new Set(),  
  partidasExistentesById: new Map(),
  partidasExistentesByIdx: new Map()
};

// ------------- UI -------------
function dot(color){ return `<span class="time-dot" style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid rgba(0,0,0,.06);box-shadow:inset 0 0 0 2px rgba(0,0,0,.05)"></span>`; }
function idPartida(dia, idx){ return `D${dia}-FG${idx+1}`; }
function toast(msg){
  let t = $('.toast');
  if(!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000);
}
function setHint(msg, type=''){
  const el = $('#hint');
  el.textContent = msg || '';
  el.style.color = type==='error' ? '#c62828' : '#555';
}

function layout(){
  const root = document.getElementById('app-inserir') || document.querySelector('main.conteudo') || document.body;
  root.innerHTML = `
    <h2>Inserir Partidas – Fase de Grupos</h2>

    <div class="inserir-toolbar">
      <label for="dia" class="small">Número da Data</label>
      <input id="dia" class="dia-input" type="number" min="1" step="1"/>
      <button id="btn-carregar" class="btn">Carregar confrontos</button>
      <span class="badge">Tipo: FG</span>
      <span class="small" id="hint"></span>
      <button id="btn-salvar-fg" class="btn primary" disabled>Salvar Fase de Grupos</button>
    </div>

    <div id="lista" class="match-list"></div>

    <!-- Modal -->
    <div class="modal-backdrop" id="dlg-backdrop" aria-hidden="true" style="display:none">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="modal-header">
          <div class="modal-title" id="dlg-title">Gols da partida</div>
          <button class="close" id="dlg-close">×</button>
        </div>
        <div class="modal-body">
          <div id="dlg-id" class="small"></div>
          <div class="goal-form">
            <select id="gf-side">
              <option value="t1">Gol — Time 1</option>
              <option value="t2">Gol — Time 2</option>
            </select>
            <input id="gf-jogador" type="text" placeholder="Jogador"/>
            <input id="gf-goleiro" type="text" placeholder="Goleiro"/>
            <label class="checkbox"><input id="gf-penalti" type="checkbox"/> Penalti</label>
            <button id="gf-add" class="btn">Adicionar gol</button>
          </div>
          <div class="goal-list" id="goal-list"></div>
        </div>
        <div class="modal-footer">
          <button id="dlg-clear" class="btn">Limpar gols</button>
          <button id="dlg-ok" class="btn primary">Concluir</button>
        </div>
      </div>
    </div>
  `;

  $('#btn-carregar').addEventListener('click', onCarregar);
  $('#btn-salvar-fg').addEventListener('click', salvarFaseDeGrupos);
  $('#dlg-close').addEventListener('click', ()=>$('#dlg-backdrop').style.display='none');
  $('#dlg-ok').addEventListener('click', ()=>$('#dlg-backdrop').style.display='none');
  $('#dlg-clear').addEventListener('click', ()=>{
    const idx = +$('#dlg-backdrop').dataset.idx;
    ST.golsPorPartida[idx] = [];
    renderGoalList(idx);
  });
  $('#gf-add').addEventListener('click', addGolFromForm);
}

function renderLista(){
  const wrap = $('#lista'); wrap.innerHTML = '';
  ST.confrontos.forEach((c, idx)=>{
    const pid = idPartida(ST.dia, idx);
    const jaSalva = ST.partidasExistentesByIdx.has(idx);
    const placar = ST.partidasExistentesByIdx.get(idx) || { g1:0, g2:0 };

    const row = document.createElement('div');
    row.className = 'match-card';
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="teams">
        <div class="time-side">
          ${dot(c.t1.cor)} <span>${c.t1.nome}</span>
          <span class="vs">vs</span>
          ${dot(c.t2.cor)} <span>${c.t2.nome}</span>
        </div>
        <div class="small">Identificador: <strong>${pid}</strong></div>
      </div>

      <div class="scorebox">
        <input type="number" class="g1" min="0" step="1" value="${placar.g1}"/>
        <div class="x">x</div>
        <input type="number" class="g2" min="0" step="1" value="${placar.g2}"/>
      </div>

      <div class="small">
        ${jaSalva ? '<span class="badge">Salva</span>' : '<span class="badge">FG</span>'}
      </div>

      <div class="actions">
        <button class="btn btn-gols"${jaSalva?' disabled':''}>Gols</button>
        <button class="btn primary btn-salvar"${jaSalva?' disabled':''}>${jaSalva?'Já salva':'Salvar partida'}</button>
      </div>
    `;

    // eventos apenas se não estiver salva
    if(!jaSalva){
      $('.btn-gols', row).addEventListener('click', ()=>abrirModal(idx));
      $('.btn-salvar', row).addEventListener('click', ()=>salvarPartida(idx));
    }else{
      // trava edição visualmente
      $('.g1', row).disabled = true;
      $('.g2', row).disabled = true;
      row.classList.add('line-disabled');
      ST.partidasSalvas.add(pid); // contabiliza como já salva
    }

    wrap.appendChild(row);
  });

  // revalida botão "Salvar Fase de Grupos"
  $('#btn-salvar-fg').disabled = (ST.partidasSalvas.size !== 6);
}


function abrirModal(idx){
  const pid = idPartida(ST.dia, idx);
  $('#dlg-backdrop').style.display = 'flex';
  $('#dlg-backdrop').dataset.idx = idx;
  $('#dlg-title').textContent = `Gols — ${pid}`;
  $('#dlg-id').textContent = `Time 1: ${ST.confrontos[idx].t1.nome} • Time 2: ${ST.confrontos[idx].t2.nome}`;
  $('#gf-side').value = 't1';
  $('#gf-jogador').value = '';
  $('#gf-goleiro').value = '';
  $('#gf-penalti').checked = false;
  if(!ST.golsPorPartida[idx]) ST.golsPorPartida[idx] = [];
  renderGoalList(idx);
}
function renderGoalList(idx){
  const list = $('#goal-list'); list.innerHTML='';
  (ST.golsPorPartida[idx]||[]).forEach((g,i)=>{
    const timeName = g.side==='t1'? ST.confrontos[idx].t1.nome : ST.confrontos[idx].t2.nome;
    const it = document.createElement('div');
    it.className = 'goal-item';
    it.innerHTML = `
      <span class="badge">${g.side.toUpperCase()}</span>
      <strong>${timeName}</strong>
      <span>• Jogador: ${g.jogador}</span>
      <span>• Goleiro: ${g.goleiro}</span>
      ${g.penalti ? '<span class="badge">Pênalti</span>': ''}
      <button class="del">remover</button>
    `;
    $('.del', it).addEventListener('click', ()=>{
      ST.golsPorPartida[idx].splice(i,1);
      renderGoalList(idx);
    });
    list.appendChild(it);
  });
}
function addGolFromForm(){
  const idx = +$('#dlg-backdrop').dataset.idx;
  const side = $('#gf-side').value;
  const jogador = $('#gf-jogador').value.trim();
  const goleiro = $('#gf-goleiro').value.trim();
  const penalti = $('#gf-penalti').checked;
  if(!jogador){ toast('Informe o jogador'); return; }
  if(!goleiro){ toast('Informe o goleiro'); return; }
  ST.golsPorPartida[idx].push({ side, jogador, goleiro, penalti });
  renderGoalList(idx);
}

// ------------- Dados / Confrontos -------------
function gerar6Confrontos(times){
  const ts = [...times].sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,4);
  const pairs = [];
  for(let i=0;i<ts.length;i++){
    for(let j=i+1;j<ts.length;j++){
      pairs.push({ t1: ts[i], t2: ts[j] });
    }
  }
  return pairs; // 6 jogos
}

// ---- NOVO: verifica se a data já foi realizada (FG ou partidas existentes) ----
async function dataJaRealizada(dia){
  try{
    const { data, error } = await db
      .from('Data')
      .select('Concluida')
      .eq('Numero', dia)
      .maybeSingle(); // retorna 1 ou null

    if(error){ console.warn(error); return false; }
    return !!(data && data.Concluida === true);
  }catch(err){
    console.warn(err);
    return false;
  }
}
async function onCarregar(){
  const dia = +$('#dia').value;
  if(!dia){ toast('Informe o número do dia'); return; }

  // 1) Se Data.Concluida = true, bloqueia tudo
  if(await dataJaRealizada(dia)){
    setHint(`A Data ${dia} está concluída. Não é possível editar.`, 'error');
    $('#lista').innerHTML = '';
    $('#btn-salvar-fg').disabled = true;
    return;
  }

  // 2) Data não concluída: pode haver partidas parciais
  ST.dia = dia;

  // carrega times (ignora FA)
  const { data, error } = await db.from('Time').select('*');
  if(error){ console.error(error); toast('Erro ao buscar times'); return; }
  const times = (data||[]).map(normalizeTimeRow).filter(t=>t.nome && t.nome.toLowerCase()!=='fa');
  if(times.length < 4){ toast('Preciso de 4 times (excluindo FA)'); return; }

  ST.times = times.slice(0,4);
  ST.confrontos = gerar6Confrontos(ST.times);
  ST.golsPorPartida = {};
  ST.partidasSalvas.clear();

  // 3) Busca partidas já existentes do dia (parciais)
  await carregarPartidasExistentes(dia);

  // 4) Renderiza lista já refletindo o que está salvo
  renderLista();

  // habilita salvar FG apenas quando todas 6 estiverem salvas
  const qtdSalvas = ST.partidasExistentesByIdx.size;
  $('#btn-salvar-fg').disabled = (qtdSalvas !== 6);
  setHint(qtdSalvas > 0
    ? `Encontradas ${qtdSalvas}/6 partidas já registradas para a Data ${dia}.`
    : `Gerados ${ST.confrontos.length} confrontos`);
}


// ------------- Persistência -------------
async function salvarPartida(idx){
  const row = $(`.match-card[data-idx="${idx}"]`);
  const g1 = Math.max(0, +$('.g1', row).value || 0);
  const g2 = Math.max(0, +$('.g2', row).value || 0);
  const c = ST.confrontos[idx];
  const pid = idPartida(ST.dia, idx);

  // GARANTIA: não duplica se já existir
  const { data: exists, error: exErr } = await db.from('Partida')
    .select('Identificador')
    .eq('Identificador', pid)
    .limit(1);
  if(exErr){ console.warn(exErr); }
  if(exists && exists.length){
    toast(`Já existe a partida ${pid}. Use outra data.`);
    return;
  }

  // 1) Partida
  const partida = {
    Identificador: pid,
    GolsTime1: g1,
    GolsTime2: g2,
    Time1: c.t1.nome,
    Time2: c.t2.nome,
    Tipo: 'FG'
  };
  const { error: errP } = await db.from('Partida').insert(partida);
  if(errP){ console.error(errP); toast(`Erro ao salvar Partida ${pid}`); return; }

  // 2) Penalti(s) + 3) Gol(s)
  const gl = ST.golsPorPartida[idx] || [];
  for(let i=0;i<gl.length;i++){
    const n = i+1;
    const golId = `${pid}-G${n}`;
    const side = gl[i].side;
    const time = side==='t1' ? c.t1.nome : c.t2.nome;
    const adv  = side==='t1' ? c.t2.nome : c.t1.nome;

    let cobrancaId = null;
    if(gl[i].penalti){
      cobrancaId = `${golId}P`;
      const pen = {
        id: cobrancaId,
        Goleiro: gl[i].goleiro,
        Batedor: gl[i].jogador,
        Convertido: true,
        Disputa: false,
        Defendido: false,
        Time: time,
        Partida: pid
      };
      const { error: errPen } = await db.from('Penalti').insert(pen);
      if(errPen){ console.error(errPen); toast(`Erro no pênalti ${cobrancaId}`); return; }
    }

    const gol = {
      Identificador: golId,
      Jogador: gl[i].jogador,
      Goleiro: gl[i].goleiro,
      Partida: pid,
      Time: time,
      TimeAdversario: adv,
      Penalti: !!gl[i].penalti,
      Cobranca: cobrancaId
    };
    const { error: errG } = await db.from('Gol').insert(gol);
    if(errG){ console.error(errG); toast(`Erro no gol ${golId}`); return; }
  }

    ST.partidasSalvas.add(pid);

  // se a linha existir ainda, travar UI
  if(row){
    row.classList.add('line-disabled');
    $('.g1', row).disabled = true;
    $('.g2', row).disabled = true;
    const btnG = $('.btn-gols', row);
    const btnS = $('.btn-salvar', row);
    if(btnG) btnG.disabled = true;
    if(btnS){ btnS.disabled = true; btnS.textContent = 'Já salva'; }
  }

  toast(`Partida ${pid} salva`);

  // habilita salvar FG quando alcançar 6
  $('#btn-salvar-fg').disabled = (ST.partidasSalvas.size !== 6);
}

async function salvarFaseDeGrupos(){
  if(!ST.dia){ toast('Informe o número do dia'); return; }

  // bloqueio extra para FG duplicada
  if(await dataJaRealizada(ST.dia)){
    toast('Esta data já possui Fase de Grupos salva.');
    setHint(`A Data ${ST.dia} já foi realizada. Selecione outra.`, 'error');
    return;
  }

  if(ST.partidasSalvas.size !== 6){ toast('Salve as 6 partidas antes'); return; }

  const fg = {
    Numero: ST.dia,     // ex.: 3
    Data: ST.dia,       // lookup para Data.Numero
    Jogos: [...ST.partidasSalvas] // ["D3-FG1",..., "D3-FG6"]
  };
  const { error } = await db.from('FaseGrupos').insert(fg);
  if(error){ console.error(error); toast('Erro ao salvar Fase de Grupos'); return; }
  toast('Fase de Grupos salva!');
  setHint(`Data ${ST.dia} salva com sucesso!`);
}

// ------------- Boot -------------
document.addEventListener('DOMContentLoaded', layout);
