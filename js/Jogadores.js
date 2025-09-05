// JS: menu mobile //
const nav = document.querySelector('.navbar');
const btn = document.querySelector('.nav-toggle');
if (nav && btn) {
    btn.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
}
// ===== FILTROS / ORDENAÇÃO — usa SOMENTE as <option> do HTML =====
const buscaEl = document.getElementById('busca');
const posEl = document.getElementById('posicao'); // ex.: <option value="">Todas as posições</option>
const timeEl = document.getElementById('time');    // ex.: <option value="">Todos os times</option>
const ordEl = document.getElementById('ordenar');
const limparEl = document.getElementById('limpar');
const headBtns = document.querySelectorAll('.tabela-head .sort');
const bodyEl = document.querySelector('.tabela-body');

const rows = Array.from(bodyEl.querySelectorAll('.tabela-row')); // só linhas reais

// normalização p/ comparações robustas
const norm = (s) => (s ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

// interpreta valores vazios como "sem filtro"
const isAll = (v) => norm(v) === '' || norm(v) === '*';

function aplicaFiltrosOrdenacao() {
    const q = norm(buscaEl?.value);
    const pos = posEl ? norm(posEl.value) : '';
    const tim = timeEl ? norm(timeEl.value) : '';

    // filtra
    rows.forEach(r => {
        const nome = norm(r.dataset.nome);
        const time = norm(r.dataset.time);
        const posi = norm(r.dataset.posicao);

        const passaBusca = !q || nome.includes(q) || time.includes(q);
        const passaPos = isAll(pos) || pos === posi;   // usa SOMENTE o value selecionado
        const passaTime = isAll(tim) || tim === time;   // idem

        r.style.display = (passaBusca && passaPos && passaTime) ? '' : 'none';
    });

    // ordena só os visíveis
    const [campo, dir] = (ordEl?.value || 'nome-asc').split('-');
    const mult = dir === 'desc' ? -1 : 1;
    const visiveis = rows.filter(r => r.style.display !== 'none');

    visiveis.sort((a, b) => {
        if (campo === 'nome') return a.dataset.nome.localeCompare(b.dataset.nome) * mult;
        if (campo === 'datas') return (parseInt(a.dataset.datas || 0, 10) - parseInt(b.dataset.datas || 0, 10)) * mult;
        if (campo === 'gols') return (parseInt(a.dataset.gols || 0, 10) - parseInt(b.dataset.gols || 0, 10)) * mult;
        return 0;
    });

    visiveis.forEach(r => bodyEl.appendChild(r));

    // feedback visual do cabeçalho
    headBtns.forEach(b => b.classList.remove('asc', 'desc'));
    const btn = Array.from(headBtns).find(b => b.dataset.sort === campo);
    if (btn) btn.classList.add(dir === 'asc' ? 'asc' : 'desc');
}

// eventos
[buscaEl, posEl, timeEl, ordEl].forEach(el => {
    if (!el) return;
    el.addEventListener('input', aplicaFiltrosOrdenacao);
    el.addEventListener('change', aplicaFiltrosOrdenacao);
});

limparEl?.addEventListener('click', () => {
    if (buscaEl) buscaEl.value = '';
    if (posEl) posEl.value = '';
    if (timeEl) timeEl.value = '';
    if (ordEl) ordEl.value = 'nome-asc';
    aplicaFiltrosOrdenacao();
});

headBtns.forEach(b => b.addEventListener('click', () => {
    const campo = b.dataset.sort;
    const atual = (ordEl?.value || '');
    const nova = atual.startsWith(campo) && atual.endsWith('asc') ? `${campo}-desc` : `${campo}-asc`;
    if (ordEl) ordEl.value = nova;
    aplicaFiltrosOrdenacao();
}));

// inicial
aplicaFiltrosOrdenacao();