async function loadComponent(id, file) {
    const res = await fetch(file);
    document.getElementById(id).innerHTML = await res.text();
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponent("navbar", "components/navbar.html");
    loadComponent("footer", "components/footer.html");
});
