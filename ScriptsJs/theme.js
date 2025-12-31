// Aplica o tema salvo ao abrir o sistema
document.addEventListener("DOMContentLoaded", () => {
    const tema = localStorage.getItem("tema");
    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});

// Alternar tema
window.toggleTheme = () => {
    document.body.classList.toggle("dark");

    localStorage.setItem(
        "tema",
        document.body.classList.contains("dark") ? "dark" : "light"
    );
};
