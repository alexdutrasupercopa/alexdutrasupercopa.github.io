// ===================== CACHE / MAP =====================
const JOGADORES_BY_NOME = new Map();

// ===================== NAV & UTILS =====================
const nav = document.querySelector('.navbar');
const btn = document.querySelector('.nav-toggle');
if (nav && btn) {
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// Normalização para comparações robustas
const norm = (s) => (s ?? '')
  .toString()
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

const isAll = (v) => norm(v) === '' || norm(v) === '*';

// Mapeia boolean/num/string para os ícones de status
const statusHtml = (v) => {
  if (v === true || v === 'ok' || v === 1)    return '<span class="status status-ok">✓</span>';   // Compareceu
  if (v === false || v === 'bad' || v === -1) return '<span class="status status-bad">✗</span>';  // Faltou
  return '<span class="status status-null">—</span>';                                             // Sem jogo / null
};

// ===================== FILTROS / ORDENAÇÃO =====================
const buscaEl  = document.getElementById('busca');
const posEl    = document.getElementById('posicao');
const timeEl   = document.getElementById('time');
const ordEl    = document.getElementById('ordenar');
const limparEl = document.getElementById('limpar');
const headBtns = document.querySelectorAll('.tabela-head .sort');
const bodyEl   = document.querySelector('.tabela-body');
const tabelaWrap = document.querySelector('.tabela-jogadores');
const isGkMode = () => tabelaWrap?.classList.contains('gk-mode');

const GK_ORDER_OPTIONS = `
  <option value="gs-desc">Gols Sofridos (↓)</option>
  <option value="gs-asc">Gols Sofridos (↑)</option>
  <option value="pr-desc">Pênaltis Contra (↓)</option>
  <option value="pr-asc">Pênaltis Contra (↑)</option>
  <option value="dp-desc">Pênaltis Defendidos (↓)</option>
  <option value="dp-asc">Pênaltis Defendidos (↑)</option>
  <option value="nome-asc">Nome (A–Z)</option>
  <option value="nome-desc">Nome (Z–A)</option>
  <option value="datas-desc">Presenças (↓)</option>
  <option value="datas-asc">Presenças (↑)</option>
`;

const DEFAULT_ORDER_OPTIONS = `
  <option value="gols-desc">Gols (↓)</option>
  <option value="gols-asc">Gols (↑)</option>
  <option value="nome-asc">Nome (A–Z)</option>
  <option value="nome-desc">Nome (Z–A)</option>
  <option value="datas-desc">Jogos (↓)</option>
  <option value="datas-asc">Jogos (↑)</option>
`;

function refreshOrderOptions(preserve = true) {
  if (!ordEl) return;
  const previous = ordEl.value;

  ordEl.innerHTML = isGkMode() ? GK_ORDER_OPTIONS : DEFAULT_ORDER_OPTIONS;

  const hasPrev = Array.from(ordEl.options).some(o => o.value === previous);

  // No gk-mode, default = "gs-asc" (menor Gols Sofridos primeiro)
  ordEl.value = preserve && hasPrev
    ? previous
    : (isGkMode() ? 'gs-asc' : 'gols-desc');
}


const btnGk = document.getElementById('toggle-gk');

btnGk?.addEventListener('click', () => {
  const ativa = tabelaWrap.classList.toggle('gk-mode');
  btnGk.setAttribute('aria-pressed', ativa ? 'true' : 'false');
  btnGk.textContent = ativa ? 'Estatísticas padrão' : 'Estatísticas de Goleiro';

  // troca opções e força default correto no novo modo
  refreshOrderOptions(false);
  aplicaFiltrosOrdenacao();
});


// Sempre pegue as linhas no DOM atual (são criadas depois do fetch)
const getRows = () => Array.from(document.querySelectorAll('.tabela-body .tabela-row'));

function aplicaFiltrosOrdenacao() {
  const rows = getRows();
  const q    = norm(buscaEl?.value);
  const pos  = posEl ? norm(posEl.value) : '';
  const tim  = timeEl ? norm(timeEl.value) : '';
  const onlyGk = isGkMode();

  // 1) Filtrar
  rows.forEach(r => {
    const nome = norm(r.dataset.nome);
    const time = norm(r.dataset.time);
    const posi = norm(r.dataset.posicao);

    const passaBusca = !q || nome.includes(q) || time.includes(q);
    const passaPos   = isAll(pos) || pos === posi;
    const passaTime  = isAll(tim) || tim === time;
    const passaGk    = !onlyGk || posi === 'goleiro';

    r.style.display = (passaBusca && passaPos && passaTime && passaGk) ? '' : 'none';
  });

  // 2) Ordenar apenas os visíveis
  const [campoRaw, dirRaw] = (ordEl?.value || (onlyGk ? 'gs-asc' : 'nome-asc')).split('-');
  const campo = campoRaw || (onlyGk ? 'gs' : 'nome');
  const dir   = dirRaw || (onlyGk ? 'asc' : 'asc');
  const mult  = dir === 'desc' ? -1 : 1;

  const visiveis = rows.filter(r => r.style.display !== 'none');

  const getNum = (r, key) => parseInt(r.dataset[key] || '0', 10) || 0;

  visiveis.sort((a, b) => {
    switch (campo) {
      case 'nome':  return a.dataset.nome.localeCompare(b.dataset.nome) * mult;
      case 'datas': return (getNum(a, 'datas') - getNum(b, 'datas')) * mult
                      || a.dataset.nome.localeCompare(b.dataset.nome);
      case 'gols':  return (getNum(a, 'gols')  - getNum(b, 'gols'))  * mult
                      || a.dataset.nome.localeCompare(b.dataset.nome);
      case 'gs':    return (getNum(a, 'gs')    - getNum(b, 'gs'))    * mult
                      || a.dataset.nome.localeCompare(b.dataset.nome);
      case 'pr':    return (getNum(a, 'pr')    - getNum(b, 'pr'))    * mult
                      || a.dataset.nome.localeCompare(b.dataset.nome);
      case 'dp':    return (getNum(a, 'dp')    - getNum(b, 'dp'))    * mult
                      || a.dataset.nome.localeCompare(b.dataset.nome);
      default:      return a.dataset.nome.localeCompare(b.dataset.nome);
    }
  });

  visiveis.forEach(r => bodyEl.appendChild(r));

  // 3) Feedback visual no cabeçalho (só aplica se existir o botão correspondente)
  headBtns.forEach(b => b.classList.remove('asc', 'desc'));
  const hbtn = Array.from(headBtns).find(b => b.dataset.sort === campo);
  if (hbtn) hbtn.classList.add(dir === 'asc' ? 'asc' : 'desc');
}


// Eventos dos filtros
[buscaEl, posEl, timeEl, ordEl].forEach(el => {
  if (!el) return;
  el.addEventListener('input', aplicaFiltrosOrdenacao);
  el.addEventListener('change', aplicaFiltrosOrdenacao);
});

limparEl?.addEventListener('click', () => {
  if (buscaEl) buscaEl.value = '';
  if (posEl)   posEl.value   = '';
  if (timeEl)  timeEl.value  = '';
  if (ordEl)   ordEl.value   = 'nome-asc';
  aplicaFiltrosOrdenacao();
});

headBtns.forEach(b => b.addEventListener('click', () => {
  const campo = b.dataset.sort;
  const atual = (ordEl?.value || '');
  const nova  = atual.startsWith(campo) && atual.endsWith('asc') ? `${campo}-desc` : `${campo}-asc`;
  if (ordEl) ordEl.value = nova;
  aplicaFiltrosOrdenacao();
}));

// ===================== SUPABASE =====================
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function carregarJogadores() {
  if (!bodyEl) return;
  bodyEl.innerHTML = ''; // limpa

  const { data, error } = await db
    .from('Jogador')
    .select('Nome, Posicao, Time, Gols, Jogos, Foto, Dia1, Dia2, Dia3, Dia4, Final,ObservacaoFA, GolsSofridos, PenaltisRecebidos, DefesasPenalti')
    .order('Nome', { ascending: true });

  if (error) {
    console.error('Erro Supabase:', error);
    bodyEl.innerHTML = '<p style="padding:12px;color:#c23b3b">Falha ao carregar jogadores.</p>';
    return;
  }

  const frag = document.createDocumentFragment();

  (data || []).forEach(j => {
    const nome    = j.Nome || '';
    const posicao = String(j.Posicao || '').toUpperCase() || 'LINHA'; // LINHA | GOLEIRO
    const time    = j.Time || '';                                      // "Preto", "Branco", ...
    const gols    = Number(j.Gols || 0);
    const datas   = Number(j.Jogos ?? 0); 
    const gs = Number(j.GolsSofridos ?? 0);
    const pr = Number(j.PenaltisRecebidos ?? 0);
    const dp = Number(j.DefesaPenalti ?? j.DefesasPenalti ?? 0);

    const row = document.createElement('div');   // << crie a row antes de usar
    row.className = 'tabela-row';
    row.dataset.nome    = nome;
    row.dataset.posicao = posicao;
    row.dataset.time    = time;
    row.dataset.datas   = String(datas);
    row.dataset.gols    = String(gols);

    // NOVO: datasets para ordenação no gk-mode
    row.dataset.gs = String(gs);
    row.dataset.pr = String(pr);
    row.dataset.dp = String(dp);


    // cache para abrir modal sem nova query
    JOGADORES_BY_NOME.set(nome, j);

    row.innerHTML = `
      <div class="col col-jogador">
        <div class="jogador-cell">
          <div class="avatar"><img src="${j.Foto || 'img/Placeholder.png'}" alt="${nome}" /></div>
          <div class="jogador-info" data-time="${time}">
            <div class="jogador-nome">${nome}</div>
            <div class="jogador-sub">${posicao} • ${time}</div>
          </div>
        </div>
      </div>

      <!-- Painel KPI (mobile) -->
      <div class="kpi-panel mobile-only">
        <div class="kpi-item"><span class="kpi-label">Presenças</span><span class="kpi">${datas}</span></div>
        <div class="kpi-item"><span class="kpi-label">Gols</span><span class="kpi">${gols}</span></div>
        <div class="kpi-item kpi-gk kpi-gs mobile-only"><span class="kpi-label">Presenças</span><span class="kpi">${datas}</span></div>
        <div class="kpi-item kpi-gk kpi-gs mobile-only"><span class="kpi-label">Gols Sofridos</span><span class="kpi">${gs}</span></div>
        <div class="kpi-item kpi-gk kpi-dp mobile-only"><span class="kpi-label">Defesas Pênalti</span><span class="kpi">${dp}</span></div>
      </div>
      <div class="kpi-panel mobile-only"></div>

      <!-- Colunas desktop -->
      <div class="col col-datas" data-label="Jogos"><span class="kpi">${datas}</span></div>
      <div class="col col-gols"  data-label="Gols"><span class="kpi">${gols}</span></div>
      <div class="col col-gk gk-only center" data-label="GS"><span class="kpi">${gs}</span></div>
      <div class="col col-gk gk-only center" data-label="Pên. Receb."><span class="kpi">${pr}</span></div>
      <div class="col col-gk gk-only center" data-label="Pên. Def."><span class="kpi">${dp}</span></div>
      <div class="col col-dia" data-label="Dia 1">${statusHtml(j.Dia1)}</div>
      <div class="col col-dia" data-label="Dia 2">${statusHtml(j.Dia2)}</div>
      <div class="col col-dia" data-label="Dia 3">${statusHtml(j.Dia3)}</div>
      <div class="col col-dia" data-label="Dia 4">${statusHtml(j.Dia4)}</div>
      <div class="col col-dia" data-label="Final">${statusHtml(j.Final)}</div>
    `;

    frag.appendChild(row);
  });

  bodyEl.appendChild(frag);
  aplicaFiltrosOrdenacao();
  refreshOrderOptions();
}

// Carrega na entrada
carregarJogadores();

// Realtime (opcional)
db.channel('jogadores-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Jogador' }, () => {
    carregarJogadores();
  })
  .subscribe();

aplicaFiltrosOrdenacao();

// ===================== MODAL =====================

// mapa de cores por time (use as cores que preferir)
const TEAM_COLORS = {
  'Preto':  '#222',
  'Azul':   '#1e73be',
  'Branco': '#c9c9c9',
  'Amarelo':'#f2c94c',
  'FA':'#cd0808c6'
};
// Nomes de display para os campos extras do modal
const EXTRA_LABELS = {
  ObservacaoFA: 'Observação de Free Agent',
  PenaltisRecebidos: 'Pênaltis Contra',
  DefesasPenalti: 'Defesas de Pênalti',
  // Adicione mais chaves se quiser renomear outros campos que apareçam no "extras"
  // Ex.: OutroCampo: 'Meu Nome Bonito'
};


function ensureModalRoot() {
  let overlay = document.querySelector('.modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-banner"></div>
        <div class="modal-header">
          <div class="modal-title" id="modal-title"></div>
          <button class="modal-close" aria-label="Fechar">×</button>
        </div>
        <div class="modal-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // fechar por click/esc
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) closeModal();
    });
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }
  return overlay;
}

function openModal() {
  ensureModalRoot().classList.add('open');
}
function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Reutiliza seus ícones
const statusIcon = (v) => {
  if (v === true || v === 'ok' || v === 1)   return '<span class="status status-ok">✓</span>';
  if (v === false || v === 'bad' || v === -1) return '<span class="status status-bad">✗</span>';
  return '<span class="status status-null">—</span>';
};

async function fetchJogadorDetalhe(nome) {
  const alvo = (nome || '').trim();
  const { data, error } = await db
    .from('Jogador')
    .select('*')
    .eq('Nome', alvo)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Jogador não encontrado: ${alvo}`);
  return data;
}

function renderModalJogador(j) {
  const overlay = ensureModalRoot();
  const titleEl = overlay.querySelector('.modal-title');
  const bodyEl  = overlay.querySelector('.modal-body');

  const nome    = j.Nome || '';
  const posicao = String(j.Posicao || '').toUpperCase();
  const isGoleiro = posicao === 'GOLEIRO';
  const time    = j.Time || '';
  const gols    = Number(j.Gols || 0);
  const golsSofridos = Number(j.GolsSofridos || 0); // coluna vinda do banco
  const foto    = j.Foto || 'img/Placeholder.png';

  // pinta a faixa do topo conforme o time
  const banner = overlay.querySelector('.modal-banner');
  if (banner) banner.style.background = TEAM_COLORS[time] || '#888';

   // KPIs
  const totalJogos = Number(j.Jogos ?? 0);

  titleEl.textContent = 'Detalhes do Jogador';

  // escolhe KPI principal
  let kpiExtraHtml = '';
  if (posicao === 'GOLEIRO') {
    kpiExtraHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Gols Sofridos</div>
        <div class="kpi-value">${golsSofridos}</div>
      </div>`;
  } else {
    kpiExtraHtml = `
      <div class="kpi-card">
        <div class="kpi-label">Gols</div>
        <div class="kpi-value">${gols}</div>
      </div>`;
  }

  bodyEl.innerHTML = `
    <!-- Topo: foto à esquerda, infos à direita -->
    <div class="player-top">
      <div class="player-avatar">
        <img src="${foto}" alt="${nome}">
      </div>
      <div class="player-meta">
        <div class="modal-nome">${nome}</div>
        <div class="sub">${posicao} • ${time}</div>
      </div>
    </div>

    <!-- KPIs abaixo do topo -->
    <div class="kpi-grid">
      ${kpiExtraHtml}
      <div class="kpi-card">
        <div class="kpi-label">Presenças</div>
        <div class="kpi-value">${totalJogos}</div>
      </div>
    </div>

    <!-- Presenças por dia -->
    <div>
      <h3 style="margin:10px 0 8px;font-size:1.05rem;color:#444;">Presença por dia</h3>
      <div class="days-grid">
        <div class="day-cell"><span class="day-label">Dia 1</span> ${statusIcon(j.Dia1)}</div>
        <div class="day-cell"><span class="day-label">Dia 2</span> ${statusIcon(j.Dia2)}</div>
        <div class="day-cell"><span class="day-label">Dia 3</span> ${statusIcon(j.Dia3)}</div>
        <div class="day-cell"><span class="day-label">Dia 4</span> ${statusIcon(j.Dia4)}</div>
        <div class="day-cell"><span class="day-label">Final</span> ${statusIcon(j.Final)}</div>
      </div>
    </div>

    <!-- Outras informações -->
    <div>
      <h3 style="margin:10px 0 8px;font-size:1.05rem;color:#444;">Outras informações</h3>
      <div class="extra-grid" id="extras"></div>
    </div>
  `;

// ---------- Render dinâmico dos extras ----------
const extras = overlay.querySelector('#extras');
const penContra   = Number(j.PenaltisRecebidos ?? 0);

// Campos que nunca entram na grade de extras
const HIDE_ALWAYS = new Set([
  'Nome','Posicao','Time','Foto',
  'Gols','Jogos','GolsSofridos',
  'Dia1','Dia2','Dia3','Dia4','Final',
  'created_at','updated_at','id'
]);

// Chaves relacionadas a pênaltis (cubra ambas variações de nome)
const PEN_KEYS = new Set(['PenaltisRecebidos','DefesaPenalti','DefesasPenalti']);

Object.entries(j).forEach(([key, val]) => {
  if (HIDE_ALWAYS.has(key)) return;

  // 1) ObservacaoFA só se tiver valor
  if (key === 'ObservacaoFA') {
    const txt = (val ?? '').toString().trim();
    if (!txt) return; // não renderiza
  }

  // 2) Infos de pênalti só se for goleiro E tiver pênalti contra > 0
  if (PEN_KEYS.has(key)) {
    if (!isGoleiro) return;
    if (penContra <= 0) return;
  }

  // Rótulo de display
  const label = EXTRA_LABELS[key] || key;

  // Valor exibido
  const shown = (val === null || val === undefined || (typeof val === 'string' && val.trim() === ''))
    ? '—'
    : String(val);

  const div = document.createElement('div');
  div.className = 'extra-item';
  div.innerHTML = `
    <div class="extra-key">${label}</div>
    <div class="extra-val">${shown}</div>
  `;
  extras.appendChild(div);
});


  openModal();
}

// Abre modal ao clicar numa linha (Nome como chave)
document.querySelector('.tabela-body')?.addEventListener('click', async (e) => {
  const row = e.target.closest('.tabela-row');
  if (!row) return;

  const nome = row.dataset.nomeKey || row.dataset.nome;
  if (!nome) return;

  // 1º tenta do cache
  const cached = JOGADORES_BY_NOME.get(nome);
  if (cached) {
    renderModalJogador(cached);
    return;
  }

  // fallback: busca no Supabase pelo Nome
  try {
    const jogador = await fetchJogadorDetalhe(nome);
    renderModalJogador(jogador);
  } catch (err) {
    console.error('Erro ao carregar detalhes:', err);
    alert('Não foi possível carregar os detalhes do jogador.');
  }
});
