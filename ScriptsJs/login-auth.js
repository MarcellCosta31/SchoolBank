import { login } from "../firebase.js";

const btn = document.querySelector(".btn");
const erro = document.getElementById("erro");

btn.addEventListener("click", async () => {
    const email = document.getElementById("login").value;
    const senha = document.getElementById("senha").value;

    try {
        await login(email, senha);
        window.location.href = "index.html";
    } catch (e) {
        erro.innerText = "❌ Email ou senha inválidos";
    }
});



