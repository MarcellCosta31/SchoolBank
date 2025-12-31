import { db } from "../firebase.js";
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    getDocs,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const seriesRef = collection(db, "configuracoes", "series", "lista");

/* ======================
   CRIAR SÉRIE
====================== */
window.criarSerie = async function () {
    const nomeSerie = document.getElementById("nomeSerie").value.trim();

    if (!nomeSerie) {
        alert("Informe o nome da série");
        return;
    }

    const idSerie = nomeSerie.replace(/\s+/g, "_").toLowerCase();

    await setDoc(doc(seriesRef, idSerie), {
        nome: nomeSerie,
        disciplinas: []
    });

    document.getElementById("nomeSerie").value = "";
    carregarSeries();
};

/* ======================
   ADICIONAR DISCIPLINA
====================== */
window.adicionarDisciplina = async function () {
    const serieId = document.getElementById("selectSerie").value;
    const disciplina = document.getElementById("nomeDisciplina").value.trim();

    if (!serieId || !disciplina) {
        alert("Selecione a série e informe a disciplina");
        return;
    }

    await updateDoc(doc(seriesRef, serieId), {
        disciplinas: arrayUnion(disciplina)
    });

    document.getElementById("nomeDisciplina").value = "";
    carregarSeries();
};

/* ======================
   CARREGAR SÉRIES
====================== */
async function carregarSeries() {
    const snapshot = await getDocs(seriesRef);

    const select = document.getElementById("selectSerie");
    const lista = document.getElementById("listaSeries");

    select.innerHTML = `<option value="">Selecione a Série</option>`;
    lista.innerHTML = "";

    snapshot.forEach(docSnap => {
        const data = docSnap.data();

        // Select
        select.innerHTML += `
            <option value="${docSnap.id}">
                ${data.nome}
            </option>
        `;

        // Lista visual
        lista.innerHTML += `
            <div class="card">
                <h3>${data.nome}</h3>
                <ul>
                    ${data.disciplinas.map(d => `<li>${d}</li>`).join("")}
                </ul>
            </div>
        `;
    });
}

carregarSeries();
