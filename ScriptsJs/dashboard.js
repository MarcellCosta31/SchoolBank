import {
    verificarLogin,
    auth,
    obterTotaisMes,
    obterUltimasTransacoes,
    monitorarUltimasTransacoes,
    monitorarEstatisticasDashboard
} from "../firebase.js";

/* ======================
   PROTEÇÃO DE LOGIN
====================== */
verificarLogin(user => {
    if (!user) window.location.href = "login.html";
});

/* ======================
   ELEMENTOS
====================== */
const el = id => document.getElementById(id);

const totalPagoEl = el("totalPago");
const totalTiradoEl = el("totalTirado");
const ativosEl = el("ativos");
const totalFuncionariosEl = el("totalFuncionarios");
const percentualAtivosEl = el("percentualAtivos");
const tabelaPagamentos = el("ultimosPagamentos");
const contagemTransacoes = el("contagemTransacoes");
const ultimaAtualizacao = el("ultimaAtualizacao");
const nomeUsuario = el("nomeUsuario");
const btnAtualizar = el("btnAtualizar");

/* ======================
   USUÁRIO
====================== */
auth.onAuthStateChanged(user => {
    if (user) {
        const nome = user.email.split("@")[0];
        nomeUsuario.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
    }
});

/* ======================
   DATA
====================== */
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

/* ======================
   AUXILIARES
====================== */
const formatarMoeda = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function atualizarHora() {
    ultimaAtualizacao.textContent =
        "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

/* ======================
   ESTATÍSTICAS
====================== */
monitorarEstatisticasDashboard(d => {
    totalFuncionariosEl.textContent = d.totalFuncionarios || 0;
    ativosEl.textContent = d.totalAtivos || 0;

    const perc = d.totalFuncionarios
        ? Math.round((d.totalAtivos / d.totalFuncionarios) * 100)
        : 0;

    percentualAtivosEl.textContent = `${perc}% ativos`;
    atualizarHora();
});

/* ======================
   TOTAIS DO MÊS
====================== */
async function carregarTotais() {
    const t = await obterTotaisMes(mesAtual);
    totalPagoEl.textContent = formatarMoeda(t.totalPago);
    totalTiradoEl.textContent = formatarMoeda(t.totalDescontado);
}

/* ======================
   TRANSAÇÕES
====================== */
function renderTransacoes(lista) {
    tabelaPagamentos.innerHTML = "";
    contagemTransacoes.textContent = `${lista.length} transações`;

    lista.forEach(t => {
        tabelaPagamentos.innerHTML += `
        <tr>
            <td>${t.funcionarioNome || "-"}</td>
            <td>${t.tipo}</td>
            <td>${t.opcaoNome || "-"}</td>
            <td>${formatarMoeda(t.valorTotal || t.valorUnitario || 0)}</td>
            <td>${new Date(t.dataRegistro).toLocaleDateString("pt-BR")}</td>
        </tr>`;
    });
}

monitorarUltimasTransacoes(renderTransacoes);

/* ======================
   EVENTOS
====================== */
btnAtualizar.addEventListener("click", async () => {
    await carregarTotais();
    renderTransacoes(await obterUltimasTransacoes());
    atualizarHora();
});

/* ======================
   INIT
====================== */
carregarTotais();
atualizarHora();
