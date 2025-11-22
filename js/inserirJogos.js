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

// Configuração dos 4 jogos de mata-mata
const MATA_CFG = [
  { key:'S1', label:'Semifinal 1', tipo:'Semi' },
  { key:'S2', label:'Semifinal 2', tipo:'Semi' },
  { key:'DT', label:'Disputa do Terceiro', tipo:'DisputaDeTerceiro' },
  { key:'F',  label:'Final', tipo:'Final' }
];
const idMata = (dia, key) => `D${dia}-${key}`;

// Estende o estado (não remove nada do que você já tem)
Object.assign(ST, {
  mata: [],                // [{key,label,tipo,t1,t2,fp,g1,g2}]
  golsMata: {},            // key -> gols[]
  penMata: {},             // key -> cobranças[]
  partidasMataSalvas: new Set(),
  mataBloqueado: new Set()
});


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
      <span class="small" id="hint"></span>
      <button id="btn-salvar-fg" class="btn primary" disabled>Salvar Fase de Grupos</button>
    </div>

    <div id="lista" class="match-list"></div>

    <h2 style="margin-top:22px">Mata-Mata</h2>
    <div id="lista-mata" class="match-list"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button id="btn-salvar-mm" class="btn primary" disabled>Salvar Mata-Mata</button>
    </div>


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

    <!-- Modal Disputa de Pênaltis -->
    <div class="modal-backdrop" id="pen-backdrop" style="display:none">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title" id="pen-title">Disputa de Pênaltis</div>
          <button class="close" id="pen-close">×</button>
        </div>
        <div class="modal-body">
          <div id="pen-id" class="small"></div>
          <div class="pen-form">
            <select id="pf-side">
              <option value="t1">Batedor — Time 1</option>
              <option value="t2">Batedor — Time 2</option>
            </select>
            <input id="pf-batedor" type="text" placeholder="Batedor"/>
            <input id="pf-goleiro" type="text" placeholder="Goleiro"/>
            <label class="checkbox"><input id="pf-convertido" type="checkbox"/> Convertido</label>
            <label class="checkbox"><input id="pf-defendido" type="checkbox"/> Defendido</label>
            <button id="pf-add" class="btn">Adicionar cobrança</button>
          </div>
          <div class="goal-list" id="pen-list"></div>
        </div>
        <div class="modal-footer">
          <button id="pen-clear" class="btn">Limpar cobranças</button>
          <button id="pen-ok" class="btn primary">Concluir</button>
        </div>
      </div>
    </div>

  `;

  $('#btn-carregar').addEventListener('click', onCarregar);
  $('#btn-salvar-fg').addEventListener('click', salvarFaseDeGrupos);
  $('#btn-salvar-mm').addEventListener('click', salvarMataMata);
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
function renderMata(){
  const wrap = document.getElementById('lista-mata');
  wrap.innerHTML = '';
  ST.mata.forEach(m => {
    const pid = idMata(ST.dia, m.key);
    const blocked = ST.mataBloqueado.has(pid);

    const opts = ['','...Selecione', ...ST.times.map(t=>t.nome)];
    const optHtml = sel => opts.map((nm,i)=>
      `<option value="${nm}" ${nm===sel?'selected':''} ${i===1?'disabled':''}>${nm||'—'}</option>`).join('');

    const el = document.createElement('div');
    el.className = 'match-card' + (blocked ? ' line-disabled' : '');
    el.dataset.key = m.key;
    el.innerHTML = `
      <div class="teams">
        <div class="time-side">
          <select class="sel1" ${blocked?'disabled':''}>${optHtml(m.t1||'')}</select>
          <span class="vs">vs</span>
          <select class="sel2" ${blocked?'disabled':''}>${optHtml(m.t2||'')}</select>
        </div>
        <div class="small">${m.label} • <strong>${pid}</strong></div>
      </div>
      <div class="scorebox">
        <input type="number" class="g1" min="0" step="1" value="${m.g1||0}" ${blocked?'disabled':''}/>
        <div class="x">x</div>
        <input type="number" class="g2" min="0" step="1" value="${m.g2||0}" ${blocked?'disabled':''}/>
      </div>
      <div class="small">
        <span class="badge">${m.tipo}</span>
        <label class="checkbox" style="margin-left:8px">
          <input type="checkbox" class="fp" ${m.fp?'checked':''} ${blocked?'disabled':''}/> Foi pros pênaltis
        </label>
      </div>
      <div class="actions">
        <button class="btn ghost sm btn-gols" ${blocked?'disabled':''}>Gols</button>
        <button class="btn ghost sm btn-pens" ${blocked?'disabled':''}>Pênaltis</button>
        <button class="btn primary sm btn-salvar" ${blocked?'disabled':''}>Salvar partida</button>
      </div>`;
    el.querySelector('.sel1').addEventListener('change', e=> m.t1 = e.target.value || null);
    el.querySelector('.sel2').addEventListener('change', e=> m.t2 = e.target.value || null);
    el.querySelector('.fp').addEventListener('change', e=> m.fp = e.target.checked);
    el.querySelector('.btn-gols').addEventListener('click', ()=> abrirGolsMata(m.key));
    el.querySelector('.btn-pens').addEventListener('click', ()=> abrirPenaltis(m.key));
    el.querySelector('.btn-salvar').addEventListener('click', ()=> salvarPartidaMata(m.key));
    wrap.appendChild(el);
  });
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
function abrirGolsMata(mKey){
  // Reaproveita seu modal existente (id="dlg-backdrop")
  const pid = idMata(ST.dia, mKey);
  const m = ST.mata.find(x=>x.key===mKey);
  document.getElementById('dlg-backdrop').style.display = 'flex';
  document.getElementById('dlg-backdrop').dataset.scope = 'mata';
  document.getElementById('dlg-backdrop').dataset.key = mKey;
  document.getElementById('dlg-title').textContent = `Gols — ${pid}`;
  document.getElementById('dlg-id').textContent = `Time 1: ${m.t1||'—'} • Time 2: ${m.t2||'—'}`;
  document.getElementById('gf-side').value='t1';
  document.getElementById('gf-jogador').value='';
  document.getElementById('gf-goleiro').value='';
  document.getElementById('gf-penalti').checked=false;

  // renderiza a lista (usa o mesmo pattern do seu render de gols)
  const list = document.getElementById('goal-list'); list.innerHTML='';
  (ST.golsMata[mKey]||[]).forEach((g,i)=>{
    const it = document.createElement('div'); it.className='goal-item';
    it.innerHTML = `<span class="badge">${g.side.toUpperCase()}</span>
      <span>Jogador: <strong>${g.jogador}</strong></span>
      <span>• Goleiro: ${g.goleiro}</span>${g.penalti?'<span class="badge">Pênalti</span>':''}
      <button class="del">remover</button>`;
    it.querySelector('.del').addEventListener('click', ()=>{
      ST.golsMata[mKey].splice(i,1); abrirGolsMata(mKey);
    });
    list.appendChild(it);
  });

  // intercepta o botão “Adicionar gol” do modal para salvar no array do mata
  const add = document.getElementById('gf-add');
  const _old = add._mmHandler;
  if(_old) add.removeEventListener('click', _old);
  add._mmHandler = ()=> {
    const side = document.getElementById('gf-side').value;
    const jogador = document.getElementById('gf-jogador').value.trim();
    const goleiro = document.getElementById('gf-goleiro').value.trim();
    const penalti = document.getElementById('gf-penalti').checked;
    if(!jogador||!goleiro) return;
    (ST.golsMata[mKey] ||= []).push({side,jogador,goleiro,penalti});
    abrirGolsMata(mKey);
  };
  add.addEventListener('click', add._mmHandler);
}
function abrirPenaltis(mKey){
  const pid = idMata(ST.dia, mKey);
  const m = ST.mata.find(x=>x.key===mKey);

  const $pen = id => document.getElementById(id);
  $pen('pen-backdrop').style.display = 'flex';
  $pen('pen-backdrop').dataset.key = mKey;
  $pen('pen-title').textContent = `Disputa de Pênaltis — ${pid}`;
  $pen('pen-id').textContent = `Time 1: ${m.t1 || '—'} • Time 2: ${m.t2 || '—'}`;

  // limpa campos
  $pen('pf-side').value = 't1';
  $pen('pf-batedor').value = '';
  $pen('pf-goleiro').value = '';
  $pen('pf-convertido').checked = false;
  $pen('pf-defendido').checked = false;

  // renderiza lista existente
  renderPenList(mKey);

  // fecha
  $pen('pen-close').onclick = $pen('pen-ok').onclick = () => ($pen('pen-backdrop').style.display = 'none');

  // limpar tudo
  $pen('pen-clear').onclick = () => {
    ST.penMata[mKey] = [];
    renderPenList(mKey);
    $pen('pf-batedor').focus();
  };

  // função de adicionar (pode ser chamada pelo botão ou Enter)
  const addPenalty = () => {
    const side = $pen('pf-side').value;
    const batedor = $pen('pf-batedor').value.trim();
    const goleiro = $pen('pf-goleiro').value.trim();
    const convertido = $pen('pf-convertido').checked;
    const defendido = $pen('pf-defendido').checked;
    if(!batedor || !goleiro){ toast('Informe batedor e goleiro'); return; }

    (ST.penMata[mKey] ||= []).push({ side, batedor, goleiro, convertido, defendido });
    renderPenList(mKey);

    // prepara pra próxima: limpa e foca de novo
    $pen('pf-batedor').value = '';
    $pen('pf-goleiro').value = '';
    $pen('pf-convertido').checked = false;
    $pen('pf-defendido').checked = false;
    $pen('pf-batedor').focus();
  };

  // botão "Adicionar cobrança"
  $pen('pf-add').onclick = addPenalty;

  // atalho: Enter em batedor/goleiro adiciona sem fechar
  ['pf-batedor','pf-goleiro'].forEach(id=>{
    const el = $pen(id);
    el.onkeydown = (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); addPenalty(); } };
  });

  // foca no início
  $pen('pf-batedor').focus();
}
function renderPenList(mKey){
  const list = document.getElementById('pen-list');
  list.innerHTML = '';
  (ST.penMata[mKey] || []).forEach((p,i)=>{
    const it = document.createElement('div');
    it.className = 'goal-item';
    it.innerHTML = `
      <span class="badge">${p.side.toUpperCase()}</span>
      <span>Batedor: <strong>${p.batedor}</strong></span>
      <span>• Goleiro: ${p.goleiro}</span>
      ${p.convertido ? '<span class="badge">Convertido</span>' : ''}
      ${p.defendido ? '<span class="badge">Defendido</span>' : ''}
      <button class="del">remover</button>
    `;
    it.querySelector('.del').addEventListener('click', ()=>{
      ST.penMata[mKey].splice(i,1);
      renderPenList(mKey);
    });
    list.appendChild(it);
  });
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

async function prepararDia5(){
	// limpa estado de FG
	ST.confrontos = [];
	ST.golsPorPartida = {};
	ST.partidasSalvas.clear();
	ST.partidasExistentesById.clear();
	ST.partidasExistentesByIdx.clear();

	// Mensagem no lugar da Fase de Grupos
	const listaFG = document.getElementById('lista');
	listaFG.innerHTML = `
		<div class="match-card line-disabled">
			<div class="teams">
				<div class="small">
					<strong>Data 5</strong> não possui fase de grupos — apenas
					Disputa de 3º lugar e Final.
				</div>
			</div>
		</div>
	`;
	document.getElementById('btn-salvar-fg').disabled = true;
	setHint('Data 5: apenas Disputa de 3º (Amarelo x Azul) e Final (Preto x Branco).');

	// garante que a lista de mata-mata será refeita
	document.getElementById('lista-mata').innerHTML = '';

	// pega times já carregados em ST.times e garante que os nomes existam
	const find = (nm) => {
		const lower = nm.toLowerCase();
		return ST.times.find(t => t.nome.toLowerCase() === lower) || {
			nome: nm,
			cor: getTeamColor(nm)
		};
	};

	const amarelo = find('Amarelo');
	const azul    = find('Azul');
	const preto   = find('Preto');
	const branco  = find('Branco');

	// apenas dois jogos: disputa de 3º e final
	ST.mata = [
		{
			key: 'DT',
			label: 'Disputa do Terceiro',
			tipo: 'DisputaDeTerceiro',
			t1: amarelo.nome,
			t2: azul.nome,
			fp: false,
			g1: 0,
			g2: 0
		},
		{
			key: 'F',
			label: 'Final',
			tipo: 'Final',
			t1: preto.nome,
			t2: branco.nome,
			fp: false,
			g1: 0,
			g2: 0
		}
	];

	ST.golsMata = {};
	ST.penMata = {};
	ST.mataBloqueado = new Set();
	ST.partidasMataSalvas = new Set();

	// carrega partidas já existentes (D5-DT e D5-F) para travar se já tiver no banco
	const ids = ST.mata.map(m => idMata(ST.dia, m.key));
	const { data: partidasMM, error: errMM } = await db
		.from('Partida')
		.select('Identificador, GolsTime1, GolsTime2')
		.in('Identificador', ids);

	if (errMM) {
		console.warn('Erro ao carregar partidas do mata-mata (dia 5):', errMM);
	}

	const byId = new Map((partidasMM || []).map(p => [p.Identificador, p]));
	ST.mata.forEach(m => {
		const pid = idMata(ST.dia, m.key);
		const p = byId.get(pid);
		if (p) {
			m.g1 = p.GolsTime1 ?? 0;
			m.g2 = p.GolsTime2 ?? 0;
			ST.mataBloqueado.add(pid);
			ST.partidasMataSalvas.add(pid);
		}
	});

	renderMata();

	// habilita/desabilita botão "Salvar Mata-Mata"
	const { data: mm } = await db
		.from('MataMata')
		.select('Numero')
		.eq('Numero', ST.dia)
		.limit(1);

	const existeMM = !!(mm && mm.length);
	const esperado = ST.mata.length; // 2 jogos no dia 5
	document.getElementById('btn-salvar-mm').disabled =
		existeMM || (ST.partidasMataSalvas.size !== esperado);
}

async function onCarregar(){
	const dia = +$('#dia').value;
	if(!dia){
		toast('Informe o número do dia');
		return;
	}

	// 1) Se Data.Concluida = true, bloqueia tudo
	if(await dataJaRealizada(dia)){
		setHint(`A Data ${dia} está concluída. Não é possível editar.`, 'error');
		$('#lista').innerHTML = '';
		$('#lista-mata').innerHTML = '';
		$('#btn-salvar-fg').disabled  = true;
		$('#btn-salvar-mm').disabled  = true;
		return;
	}

	ST.dia = dia;

	// 2) Carrega times (ignora FA)
	const { data, error } = await db.from('Time').select('*');
	if(error){
		console.error(error);
		toast('Erro ao buscar times');
		return;
	}
	const times = (data || [])
		.map(normalizeTimeRow)
		.filter(t => t.nome && t.nome.toLowerCase() !== 'fa');

	if(times.length < 4){
		toast('Preciso de 4 times (excluindo FA)');
		return;
	}

	ST.times = times.slice(0, 4);

	// --- CASO ESPECIAL: DIA 5 (somente disputa de 3º e final) ---
	if (dia === 5){
		await prepararDia5();
		return;
	}

	// ---------- Fluxo normal (demais dias) ----------

	// Gera os 6 confrontos da fase de grupos
	ST.confrontos = gerar6Confrontos(ST.times);
	ST.golsPorPartida = {};
	ST.partidasSalvas.clear();

	// busca partidas de FG já existentes
	await carregarPartidasExistentes(dia);

	// renderiza FG
	renderLista();

	const qtdSalvas = ST.partidasExistentesByIdx.size;
	$('#btn-salvar-fg').disabled = (qtdSalvas !== 6);
	setHint(
		qtdSalvas > 0
			? `Encontradas ${qtdSalvas}/6 partidas já registradas para a Data ${dia}.`
			: `Gerados ${ST.confrontos.length} confrontos`
	);

	// --- inicializa mata-mata padrão (4 jogos: S1, S2, DT, F) ---
	ST.mata = MATA_CFG.map(x => ({ ...x, t1: null, t2: null, fp: false, g1: 0, g2: 0 }));
	ST.golsMata = {};
	ST.penMata = {};
	ST.partidasMataSalvas = new Set();
	ST.mataBloqueado = new Set();

	// carrega partidas de mata-mata já existentes
	const mkId = k => `D${ST.dia}-${k}`;
	const ids = ['S1','S2','DT','F'].map(mkId);

	const { data: partidasMM, error: errMM } = await db
		.from('Partida')
		.select('Identificador, Time1, Time2, GolsTime1, GolsTime2')
		.in('Identificador', ids);

	if (errMM){
		console.warn('Erro ao carregar partidas do mata-mata:', errMM);
	}

	const byId = new Map((partidasMM || []).map(p => [p.Identificador, p]));

	ST.mata.forEach(m => {
		const pid = mkId(m.key);
		const p = byId.get(pid);
		if (p){
			m.t1 = p.Time1 ?? m.t1 ?? null;
			m.t2 = p.Time2 ?? m.t2 ?? null;
			m.g1 = p.GolsTime1 ?? 0;
			m.g2 = p.GolsTime2 ?? 0;
			ST.mataBloqueado.add(pid);
			ST.partidasMataSalvas.add(pid);
		}
	});

	renderMata();

	// habilita/desabilita botão "Salvar Mata-Mata"
	const { data: mm } = await db
		.from('MataMata')
		.select('Numero')
		.eq('Numero', ST.dia)
		.limit(1);

	const existeMM = !!(mm && mm.length);
	const esperado = ST.mata.length; // 4 jogos nos dias normais
	document.getElementById('btn-salvar-mm').disabled =
		existeMM || (ST.partidasMataSalvas.size !== esperado);
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

function _placarDisputa(mKey){
  const arr = ST.penMata[mKey] || [];
  let p1=0, p2=0;
  arr.forEach(p => { if(p.side==='t1' && p.convertido) p1++; if(p.side==='t2' && p.convertido) p2++; });
  return { p1, p2 };
}

async function salvarPartidaMata(mKey){
  const row = document.querySelector(`#lista-mata .match-card[data-key="${mKey}"]`);
  const m = ST.mata.find(x=>x.key===mKey);
  const pid = idMata(ST.dia, mKey);
  if(ST.mataBloqueado.has(pid)){ toast(`Partida ${pid} já existe`); return; }

  m.g1 = Math.max(0, +(row.querySelector('.g1').value||0));
  m.g2 = Math.max(0, +(row.querySelector('.g2').value||0));
  if(!m.t1 || !m.t2 || m.t1===m.t2){ toast('Selecione times distintos'); return; }

  const { p1, p2 } = _placarDisputa(mKey);

  // 1) Partida
  const partida = {
    Identificador: pid, Tipo: m.tipo, Time1:m.t1, Time2:m.t2,
    GolsTime1:m.g1, GolsTime2:m.g2,
    FoiProsPenaltis: !!m.fp,
    PenaltisTime1: m.fp ? p1 : null,
    PenaltisTime2: m.fp ? p2 : null
  };
  let { error } = await db.from('Partida').insert(partida);
  if(error){ console.error(error); toast(`Erro Partida ${pid}`); return; }

  // 2) Disputa de pênaltis (apenas tabela Penalti)
  if(m.fp && (ST.penMata[mKey]||[]).length){
    let ordem = 1;
    const seqPorTime = { [m.t1]:0, [m.t2]:0 };
    for(const p of ST.penMata[mKey]){
      const timeNome = p.side==='t1' ? m.t1 : m.t2;
      seqPorTime[timeNome] += 1;
      const id = `${pid}-${timeNome}-${seqPorTime[timeNome]}`;
      const rec = { id, Goleiro:p.goleiro, Batedor:p.batedor, Convertido:!!p.convertido,
        Partida:pid, OrdemDisputa:ordem++, Disputa:true, Defendido:!!p.defendido, Time:timeNome };
      ({ error } = await db.from('Penalti').insert(rec));
      if(error){ console.error(error); toast(`Erro na cobrança ${id}`); return; }
    }
  }

  // 3) Gols do tempo normal (reaproveita seu modal de gols)
  const gols = ST.golsMata[mKey] || [];
  for(let i=0;i<gols.length;i++){
    const it = gols[i], n=i+1, golId = `${pid}-G${n}`;
    const t = it.side==='t1' ? m.t1 : m.t2;
    const adv = it.side==='t1' ? m.t2 : m.t1;
    let cobrancaId = null;
    if(it.penalti){
      cobrancaId = `${golId}P`;
      const pen = { id:cobrancaId, Goleiro:it.goleiro, Batedor:it.jogador, Convertido:true, Disputa:false, Defendido:false, Time:t, Partida:pid };
      ({ error } = await db.from('Penalti').insert(pen));
      if(error){ console.error(error); toast(`Erro pênalti ${cobrancaId}`); return; }
    }
    const gol = { Identificador:golId, Jogador:it.jogador, Goleiro:it.goleiro, Partida:pid, Time:t, TimeAdversario:adv, Penalti:!!it.penalti, Cobranca:cobrancaId };
    ({ error } = await db.from('Gol').insert(gol));
    if(error){ console.error(error); toast(`Erro gol ${golId}`); return; }
  }

  ST.partidasMataSalvas.add(pid); ST.mataBloqueado.add(pid);
  row.classList.add('line-disabled'); toast(`Partida ${pid} salva`);
  if(ST.partidasMataSalvas.size===4) document.getElementById('btn-salvar-mm').disabled = false;
}

async function salvarMataMata(){
	const totalEsperado = ST.mata ? ST.mata.length : 4;

	if(ST.partidasMataSalvas.size !== totalEsperado){
		toast(`Salve as ${totalEsperado} partidas antes`);
		return;
	}

	const tem = (key) => ST.mata && ST.mata.some(m => m.key === key);

	const rec = {
		Numero: ST.dia,
		Data: ST.dia,
		Semi1: tem('S1') ? idMata(ST.dia, 'S1') : null,
		Semi2: tem('S2') ? idMata(ST.dia, 'S2') : null,
		DisputaDeTerceiro: tem('DT') ? idMata(ST.dia, 'DT') : null,
		Final: tem('F') ? idMata(ST.dia, 'F') : null
	};

	const { error } = await db.from('MataMata').insert(rec);
	if(error){
		console.error(error);
		toast('Erro ao salvar Mata-Mata');
		return;
	}
	toast('Mata-Mata salvo!');
}



// ------------- Boot -------------
document.addEventListener('DOMContentLoaded', layout);
