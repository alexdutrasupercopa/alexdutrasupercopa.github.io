document.addEventListener("DOMContentLoaded", async () => {
    const navbar = document.getElementById("navbar");
    if (navbar) {
        const resp = await fetch("navbar.html");
        navbar.innerHTML = await resp.text();

        // Ativa o menu mobile
        const nav = document.querySelector('.navbar');
        const btn = document.querySelector('.nav-toggle');
        if (nav && btn) {
            btn.addEventListener('click', () => {
                const open = nav.classList.toggle('open');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        // Marca a página atual como "ativo"
        const links = document.querySelectorAll(".nav-center a");
        links.forEach(link => {
            if (link.getAttribute("href") === location.pathname.split("/").pop()) {
                link.classList.add("ativo");
            }
        });
    }
});