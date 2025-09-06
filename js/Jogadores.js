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

// Sempre pegue as linhas no DOM atual (são criadas depois do fetch)
const getRows = () => Array.from(document.querySelectorAll('.tabela-body .tabela-row'));

function aplicaFiltrosOrdenacao() {
  const rows = getRows();
  const q   = norm(buscaEl?.value);
  const pos = posEl ? norm(posEl.value) : '';
  const tim = timeEl ? norm(timeEl.value) : '';

  // 1) Filtrar
  rows.forEach(r => {
    const nome = norm(r.dataset.nome);
    const time = norm(r.dataset.time);
    const posi = norm(r.dataset.posicao);

    const passaBusca = !q || nome.includes(q) || time.includes(q);
    const passaPos   = isAll(pos) || pos === posi;
    const passaTime  = isAll(tim) || tim === time;

    r.style.display = (passaBusca && passaPos && passaTime) ? '' : 'none';
  });

  // 2) Ordenar apenas os visíveis
  const [campo, dir] = (ordEl?.value || 'nome-asc').split('-');
  const mult = dir === 'desc' ? -1 : 1;
  const visiveis = getRows().filter(r => r.style.display !== 'none');

  visiveis.sort((a, b) => {
    if (campo === 'nome')  return a.dataset.nome.localeCompare(b.dataset.nome) * mult;
    if (campo === 'datas') return (parseInt(a.dataset.datas || 0, 10) - parseInt(b.dataset.datas || 0, 10)) * mult;
    if (campo === 'gols')  return (parseInt(a.dataset.gols  || 0, 10) - parseInt(b.dataset.gols  || 0, 10)) * mult;
    return 0;
  });

  visiveis.forEach(r => bodyEl.appendChild(r));

  // 3) Feedback visual no cabeçalho
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

// Conta presenças (true) para o KPI "Jogos"
const presencasCount = (obj) => {
  const vals = [obj.Dia1, obj.Dia2, obj.Dia3, obj.Dia4, obj.Final];
  return vals.reduce((acc, v) => acc + (v === true ? 1 : 0), 0);
};

async function carregarJogadores() {
  if (!bodyEl) return;
  bodyEl.innerHTML = ''; // limpa

  const { data, error } = await db
    .from('Jogador')
    .select('Nome, Posicao, Time, Gols, Foto, Dia1, Dia2, Dia3, Dia4, Final')
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

    // KPI "Jogos" = presenças (true)
    const datas   = presencasCount(j);

    const row = document.createElement('div');
    row.className = 'tabela-row';
    row.dataset.nome    = nome;
    row.dataset.posicao = posicao;
    row.dataset.time    = time;
    row.dataset.datas   = String(datas);
    row.dataset.gols    = String(gols);
    row.dataset.nomeKey = nome;

    // cache para abrir modal sem nova query
    JOGADORES_BY_NOME.set(nome, j);

    row.innerHTML = `
      <div class="col col-jogador">
        <div class="jogador-cell">
          <div class="avatar"><img src="${j.Foto || 'img/Placeholder.png'}" alt="${nome}" /></div>
          <div class="jogador-info">
            <div class="jogador-nome">${nome}</div>
            <div class="jogador-sub">${posicao} • ${time}</div>
          </div>
        </div>
      </div>

      <!-- Painel KPI (mobile) -->
      <div class="kpi-panel mobile-only">
        <div class="kpi-item"><span class="kpi-label">Jogos</span><span class="kpi">${datas}</span></div>
        <div class="kpi-item"><span class="kpi-label">Gols</span><span class="kpi">${gols}</span></div>
      </div>

      <!-- Colunas desktop -->
      <div class="col col-datas" data-label="Jogos"><span class="kpi">${datas}</span></div>
      <div class="col col-gols"  data-label="Gols"><span class="kpi">${gols}</span></div>
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
  const time    = j.Time || '';
  const gols    = Number(j.Gols || 0);
  const foto    = j.Foto || 'img/Placeholder.png';

  // pinta a faixa do topo conforme o time
  const banner = overlay.querySelector('.modal-banner');
  if (banner) banner.style.background = TEAM_COLORS[time] || '#888';

  // KPIs
  const dias = [j.Dia1, j.Dia2, j.Dia3, j.Dia4, j.Final];
  const totalJogos = dias.reduce((acc, v) => acc + ((v === true || v === false) ? 1 : 0), 0);

  titleEl.textContent = 'Detalhes do Jogador';

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
      <div class="kpi-card">
        <div class="kpi-label">Gols</div>
        <div class="kpi-value">${gols}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Jogos</div>
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

  // Render dinâmico dos extras
  const extras = overlay.querySelector('#extras');
  const ignorar = new Set([
    'Nome','Posicao','Time','Gols','Foto',
    'Dia1','Dia2','Dia3','Dia4','Final',
    'created_at','updated_at','id' // caso exista
  ]);

  Object.entries(j).forEach(([k, v]) => {
    if (ignorar.has(k)) return;
    const div = document.createElement('div');
    div.className = 'extra-item';
    div.innerHTML = `
      <div class="extra-key">${k}</div>
      <div class="extra-val">${v === null || v === undefined ? '—' : String(v)}</div>
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

  console.log('[CLICK] Abrindo modal para:', nome);
  console.log('[CACHE HAS]', JOGADORES_BY_NOME.has(nome));

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
