// =========================
// Credenciais do Supabase
// =========================
const SUPABASE_URL = "https://gbgfndczbrqclmpzpvol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2ZuZGN6YnJxY2xtcHpwdm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTQxNzcsImV4cCI6MjA3MjY5MDE3N30.WXOGWuEiVesBV8Rm_zingellNhV0ClF9Nxkzp-ULs80";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// Menu mobile
// =========================
const nav = document.querySelector('.navbar')
const btn = document.querySelector('.nav-toggle')
if (nav && btn) {
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open')
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
}

// =========================================================================
// Destaques (Home) - Artilheiro e Melhor Goleiro
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  montarDestaques()
})

async function montarDestaques() {
  const elArtilheiro = document.getElementById('card-artilheiro')
  const elGoleiro   = document.getElementById('card-goleiro')
  if (!elArtilheiro && !elGoleiro) return

  try {
    const listaBruta = await obterListaJogadores()
    const lista = listaBruta.map(mapearJogadorSupabase)

    const artilheiros = obterArtilheiros(lista)        // ← agora lista
    const melhoresGks = obterMelhoresGoleiros(lista)   // ← agora lista

    // limpa os contêineres
    if (elArtilheiro) elArtilheiro.innerHTML = ''
    if (elGoleiro)    elGoleiro.innerHTML    = ''

    // renderiza todos os artilheiros empatados
    if (elArtilheiro && artilheiros.length) {
      artilheiros
        .sort((a,b) => (b.jogos||0)-(a.jogos||0) || normalizar(a.nome).localeCompare(normalizar(b.nome)))
        .forEach(j => {
          const card = document.createElement('article')
          card.className = 'cardDestaques'
          elArtilheiro.appendChild(card)
          renderizarCard(card, j, {
            tipo: 'art',
            labelEsq: 'Gols',
            valorEsq: j.gols,
            labelDir: 'Presenças',
            valorDir: j.jogos
          })
        })
    }

    // renderiza todos os goleiros empatados
    if (elGoleiro && melhoresGks.length) {
      melhoresGks
        .sort((a,b) => (a.jogos||0)-(b.jogos||0) || normalizar(a.nome).localeCompare(normalizar(b.nome)))
        .forEach(j => {
          const card = document.createElement('article')
          card.className = 'cardDestaques'
          elGoleiro.appendChild(card)
          renderizarCard(card, j, {
            tipo: 'gk',
            labelEsq: 'Gols Sofridos',
            valorEsq: j.golsS,
            labelDir: 'Presenças',
            valorDir: j.jogos
          })
        })
    }
  } catch (e) {
    console.error('Erro ao montar destaques:', e)
  }
}


// =========================
// Busca de dados
// =========================
async function obterListaJogadores() {
  const { data, error } = await db
    .from('Jogador')
    .select('Nome,Time,Posicao,Gols,GolsSofridos,Jogos,Foto')

  if (error) {
    console.error('Erro Supabase:', error)
    return []
  }
  return data || []
}

// =========================
// Mapeamento (campos exatos)
// =========================
function mapearJogadorSupabase(raw) {
  return {
    id: raw.Nome,
    nome: raw.Nome || '',
    time: raw.Time || '',
    posicao: raw.Posicao || '',
    gols: Number(raw.Gols || 0),
    golsS: Number(raw.GolsSofridos || 0),
    jogos: Number(raw.Jogos || 0),
    foto: raw.Foto || ''
  }
}

// =========================
// Lógicas de seleção
// =========================
function obterArtilheiro(lista) {
  return [...lista].sort((a, b) => {
    if (b.gols !== a.gols) return b.gols - a.gols
    if (b.jogos !== a.jogos) return b.jogos - a.jogos
    return normalizar(a.nome).localeCompare(normalizar(b.nome))
  })[0]
}

function obterMelhorGoleiro(lista) {
  const goleiros = lista.filter(j => /goleir/i.test(j.posicao || ''))
  if (!goleiros.length) return null

  return goleiros.sort((a, b) => {
    if (a.golsS !== b.golsS) return a.golsS - b.golsS
    const ma = a.jogos ? a.golsS / a.jogos : a.golsS
    const mb = b.jogos ? b.golsS / b.jogos : b.golsS
    if (ma !== mb) return ma - mb
    return normalizar(a.nome).localeCompare(normalizar(b.nome))
  })[0]
}
  function obterArtilheiros(lista) {
    if (!lista?.length) return []
    const max = Math.max(...lista.map(j => j.gols || 0))
    if (!isFinite(max)) return []
    return lista.filter(j => (j.gols || 0) === max)
  }

  function obterMelhoresGoleiros(lista) {
    const goleiros = (lista || []).filter(j => /goleir/i.test(j.posicao || ''))
    if (!goleiros.length) return []
    const min = Math.min(...goleiros.map(j => j.golsS ?? Infinity))
    if (!isFinite(min)) return []
    // mostra TODOS os com o menor número de gols sofridos (empate)
    return goleiros.filter(j => (j.golsS ?? Infinity) === min)
  }


// =========================
// Renderização dos cards
// =========================
function renderizarCard(el, jogador, info) {
  if (!el || !jogador) return
  const placeholder = 'assets/img/placeholder-user.png'
  const foto = jogador.foto && jogador.foto.trim() ? jogador.foto : placeholder

  const isArt = info?.tipo === 'art'
  const badgeHtml = `
    
    <div class="badgeDestaque ${isArt ? 'artilheiro' : 'luvaDeOuro'}">
      <span class="badgeIcon">${isArt ? '🥇' : '🧤'}</span>
      <span>${isArt ? 'Artilheiro' : 'Luva de Ouro'}</span>
    </div>`

  el.classList.remove('skeleton')
  el.innerHTML = `
    ${badgeHtml}
    <div class="topoCard">
      <img class="fotoJogador"
           src="${foto}"
           alt="${jogador.nome}"
           onerror="this.onerror=null;this.src='${placeholder}'">
      <div>
        <div class="jogadorNome">${jogador.nome || '—'}</div>
        <div class="timePosicaoJogador">${(jogador.posicao || '').toUpperCase()} • ${jogador.time || ''}</div>
      </div>
    </div>
    <div class="statsJogador">
      <div class="statJogador">
        <div class="nomeStatJogador">${info.labelEsq}</div>
        <div class="valorStatJogador">${info.valorEsq ?? 0}</div>
      </div>
      <div class="statJogador">
        <div class="nomeStatJogador">${info.labelDir}</div>
        <div class="valorStatJogador">${info.valorDir ?? 0}</div>
      </div>
    </div>
  `

  el.style.cursor = 'pointer'
  el.addEventListener('click', () => {
    if (typeof window.abrirModalJogador === 'function') {
      window.abrirModalJogador(jogador.id || jogador.nome)
    }
  })
}


// =========================
// Helpers
// =========================
function normalizar(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
