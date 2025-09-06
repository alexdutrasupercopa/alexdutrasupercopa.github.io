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

// Acessos aos elementos de filtro
const buscaEl  = document.getElementById('busca');
const posEl    = document.getElementById('posicao');
const timeEl   = document.getElementById('time');
const ordEl    = document.getElementById('ordenar');
const limparEl = document.getElementById('limpar');
const headBtns = document.querySelectorAll('.tabela-head .sort');
const bodyEl   = document.querySelector('.tabela-body');

// Sempre pegue as linhas no DOM atual (pois são criadas depois do fetch)
const getRows = () => Array.from(document.querySelectorAll('.tabela-body .tabela-row'));

// ===================== FILTRO / ORDENAÇÃO =====================
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
  const btn = Array.from(headBtns).find(b => b.dataset.sort === campo);
  if (btn) btn.classList.add(dir === 'asc' ? 'asc' : 'desc');
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

// ===================== SUPABASE – CARREGAR JOGADORES =====================
// Configure suas credenciais
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
  bodyEl.innerHTML = ''; // limpa/placeholder opcional

  // Se algum campo no banco tiver espaços no nome, use alias:
  // .select('Nome, Posicao, Time, Gols, Foto, "Dia1", "Dia2", "Dia3", "Dia4", "Final"')
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

    // KPI "Jogos" = quantidade de presenças (true)
    const datas   = presencasCount(j);

    const row = document.createElement('div');
    row.className = 'tabela-row';
    row.dataset.nome    = nome;
    row.dataset.posicao = posicao;
    row.dataset.time    = time;
    row.dataset.datas   = String(datas);
    row.dataset.gols    = String(gols);

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

  // Aplica filtros/ordenação agora que as linhas existem
  aplicaFiltrosOrdenacao();
}

// Carrega na entrada
carregarJogadores();

// (Opcional) Realtime: recarrega a lista quando a tabela mudar
db.channel('jogadores-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Jogador' }, () => {
    carregarJogadores();
  })
  .subscribe();

// Inicializar estado visual de ordenação quando não houver dados ainda
aplicaFiltrosOrdenacao();
