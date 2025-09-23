// Estrutura de dados das seções (facilita manutenção/edição posterior)
const REG_SECTIONS = [
  {
    id: "formato",
    title: "1. Formato da competição",
    html: `
      <p>O torneio será dividido em 5 datas. As 4 primeiras terão o formato habitual com: fase de grupos, semifinais, final e disputa de terceiro lugar. Os times ganharão pontos de acordo com sua colocação na fase de grupos e com a sua posição final no dia.</p>
      <div class="grid-2">
        <div class="card">
          <h4>Pontuação na fase de grupos</h4>
          <ul>
            <li>1°: 3 pontos</li>
            <li>2°: 2 pontos</li>
            <li>3°: 1 ponto</li>
            <li>4°: 0 pontos</li>
          </ul>
        </div>
        <div class="card">
          <h4>Pontuação por posição final no dia</h4>
          <ul>
            <li>1°: 5 pontos</li>
            <li>2°: 3 pontos</li>
            <li>3°: 2 pontos</li>
            <li>4°: 1 ponto</li>
          </ul>
        </div>
      </div>
      <p>A última data será composta por uma final e uma disputa de terceiro lugar (2 tempos de 20 minutos cada). Os dois times que acumularam mais pontos nos outros quatro dias se classificarão para a final.</p>
    `
  },
  {
    id: "criterios",
    title: "2. Critérios de desempate",
    html: `
      <h4>Nas fases de grupos</h4>
      <ol class="list-rank">
        <li>Saldo de gols</li>
        <li>Vitórias</li>
        <li>Confronto direto</li>
        <li>Gols feitos</li>
      </ol>
      <p>Em caso de persistência do empate, será definido por sorteio.</p>
      <br>
      <h4>Na classificação geral</h4>
      <ol class="list-rank">
        <li>Número de vezes em primeiro lugar</li>
        <li>Número de vezes em segundo lugar</li>
        <li>Número de jogos vencidos</li>
        <li>Saldo de gols</li>
        <li>Mais vitórias no confronto direto</li>
      </ol>
      <p>Em caso de persistência do empate, será decidido por sorteio.</p>
    `
  },
  {
    id: "times",
    title: "3. Sobre os times",
    html: `
      <ul>
        <li>Os quatro times foram definidos pelos quatro capitães do torneio. Os times não têm limite de jogadores e poderão utilizar reservas.</li>
        <li>Caso o time não tenha goleiro, um jogador de linha do próprio time deverá jogar no gol.</li>
        <li>Se o time não tiver jogadores suficientes, pode chamar alguém de outro time somente para o gol. Com menos de 4 atletas, perde os pontos da data (WO) e recebe punição de 2 pontos.</li>
      </ul>
    `
  },
  {
    id: "freeAgency",
    title: "3.2 Free Agency",
    html: `
      <ul>
        <li>Novos jogadores que entrarem após as escolhas se tornam Free Agents.</li>
        <li>No primeiro jogo, jogam pelo time com menos jogadores na rodada.</li>
        <li>Em caso de empate no número de jogadores, usa-se a ordem inversa da classificação para prioridade.</li>
        <li>Após o primeiro jogo, os capitães podem selecionar os Free Agents, com prioridade na ordem inversa da classificação atual.</li>
      </ul>
    `
  },
  {
    id: "jogos",
    title: "4. Sobre os jogos",
    html: `
      <ul>
        <li>Nas quatro primeiras datas, os jogos da fase de grupos têm 7 minutos; os mata-mata têm dois tempos de 6 minutos, exceto a disputa de 3º (1 tempo de 7 minutos).</li>
        <li>Na data final, a final e a disputa de 3º lugar têm dois tempos de 20 minutos, alternados.</li>
        <li>A ordem dos jogos é definida com antecedência; atraso máximo para o primeiro jogo: 10 minutos.</li>
      </ul>
    `
  },
  {
    id: "premiacoes",
    title: "5. Sobre as premiações",
    html: `
      <p>Jogadores dos três melhores times recebem medalhas (ouro, prata e bronze). Artilheiro e melhor jogador recebem troféu.</p>
      <p>Para concorrer a melhor jogador: participar de ao menos 60% (3 datas). Para votar: participar de ao menos 60% (3 datas) e estar presente na última data. Não é permitido votar em si mesmo.</p>
    `
  }
];

// ---------- Render do acordeão ----------
function makeItem({ id, title, html }, idx) {
  const sec = document.createElement('section');
  sec.className = 'acc-item';
  sec.id = id;

  const headerId = `acc-h-${id}`;
  const panelId = `acc-p-${id}`;
  const expanded = idx === 0 ? 'true' : 'false';

  sec.innerHTML = `
    <h3 class="acc-header" id="${headerId}">
      <button class="acc-trigger" aria-expanded="${expanded}" aria-controls="${panelId}">
        <span class="acc-title">${title}</span>
        <span class="acc-icon" aria-hidden="true">▸</span>
      </button>
    </h3>
    <div class="acc-panel" id="${panelId}" role="region" aria-labelledby="${headerId}" ${idx === 0 ? '' : 'hidden'}>
      <div class="acc-content">${html}</div>
    </div>
  `;
  return sec;
}

function toggle(triggerEl, forceExpand) {
  const expand = forceExpand ?? (triggerEl.getAttribute('aria-expanded') !== 'true');
  triggerEl.setAttribute('aria-expanded', String(expand));
  const panel = document.getElementById(triggerEl.getAttribute('aria-controls'));
  if (!panel) return;
  if (expand) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
}

function expandAll(root, value = true) {
  root.querySelectorAll('.acc-trigger').forEach(btn => toggle(btn, value));
}

function openByHash(root) {
  if (!location.hash) return;
  const id = location.hash.slice(1);
  const sec = root.querySelector(`#${CSS.escape(id)}`);
  if (!sec) return;
  const btn = sec.querySelector('.acc-trigger');
  if (btn) toggle(btn, true);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('regAccordion');
  REG_SECTIONS.forEach((s, i) => root.appendChild(makeItem(s, i)));

  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.acc-trigger');
    if (!btn) return;
    toggle(btn);
  });

  document.getElementById('btnExpandAll')?.addEventListener('click', () => expandAll(root, true));
  document.getElementById('btnCollapseAll')?.addEventListener('click', () => expandAll(root, false));

  openByHash(root);
  window.addEventListener('hashchange', () => openByHash(root));
});
