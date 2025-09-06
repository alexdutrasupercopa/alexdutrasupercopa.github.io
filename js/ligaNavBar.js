// js/ligaNavBar.js
async function injectLigaNavbar(targetId = "ligaNavBar", url = "ligaNavBar.html") {
  const host = document.getElementById(targetId);
  if (!host) return;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    host.innerHTML = await res.text();

    // ===== Ativar link da página atual =====
    const getBase = (s) => (s || "").split("#")[0].split("?")[0].toLowerCase();
    const currentFile = getBase((location.pathname.split("/").pop() || "MinhaLiga.html"));

    // Query params (para Dia.html?n=1 ou ?final=1)
    const u = new URL(location.href);
    const qn = u.searchParams.get("n");
    const qFinal = u.searchParams.get("final");

    const anchors = host.querySelectorAll("a");

    // 1) Caso especial: Dia.html com query -> marcar exatamente o dia
    if (currentFile === "dia.html") {
      let marked = false;

      // Final
      if (qFinal) {
        anchors.forEach(a => {
          const href = a.getAttribute("href") || "";
          if (href.toLowerCase().startsWith("dia.html") && href.includes("final=")) {
        a.classList.add("ativo");
            marked = true;
    }
    });
      }

      // Dia N
      if (!marked && qn) {
        anchors.forEach(a => {
          const href = a.getAttribute("href") || "";
          if (href.toLowerCase().startsWith("dia.html") && href.includes(`n=${qn}`)) {
            a.classList.add("ativo");
            marked = true;
          }
        });
      }

      // Fallback: se não der match por algum motivo, marca qualquer Dia.html
      if (!marked) {
        anchors.forEach(a => {
          const href = (a.getAttribute("href") || "").toLowerCase();
          if (getBase(href) === "dia.html") a.classList.add("ativo");
        });
      }
    } else {
      // 2) Demais páginas: comparar pelo arquivo base
      anchors.forEach(a => {
        const hrefBase = getBase(a.getAttribute("href") || "");
        // "Resumo" = MinhaLiga.html
        if (currentFile.endsWith(hrefBase)) a.classList.add("ativo");
      });
    }

    // ===== Toggle mobile (abre/fecha) =====
    const nav = host.querySelector(".liga-navbar");
    const toggle = host.querySelector(".nav-toggle");
    if (nav && toggle) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  } catch (e) {
    console.error("Falha ao carregar ligaNavBar:", e);
  }
}

// injeta quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  injectLigaNavbar("ligaNavBar", "ligaNavBar.html");
});
