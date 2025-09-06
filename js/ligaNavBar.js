async function injectHTML(targetId, url) {
  const host = document.getElementById(targetId);
  if (!host) return;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    host.innerHTML = await res.text();

    // Marcar link ativo
    // Marcar link ativo
    const path = (location.pathname.split("/").pop() || "MinhaLiga.html").toLowerCase();

    host.querySelectorAll("a").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();

    // Resumo = MinhaLiga
    if ((path === "minhaliga.html" && href.includes("minhaliga")) ||
        path === href) {
        a.classList.add("ativo");
    }
    });


    // Toggle mobile (reaproveita o mesmo botão ☰ do seu tema)
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
  injectHTML("ligaNavBar", "ligaNavBar.html");
});
