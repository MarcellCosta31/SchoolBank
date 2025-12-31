/* =======================
   IMPORTS
======================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    limit,
    setDoc, 
    increment   
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* =======================
   CONFIGURAÇÃO FIREBASE
======================= */
const firebaseConfig = {
    apiKey: "AIzaSyBCn1Aq6zZCyPpz3TmwMdvtWrjZ4_HA4Dw",
    authDomain: "schoolbank-6d408.firebaseapp.com",
    projectId: "schoolbank-6d408",
    storageBucket: "schoolbank-6d408.firebasestorage.app",
    messagingSenderId: "439669562614",
    appId: "1:439669562614:web:85ea3d46f8141a4355e0d7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Sessão ativa apenas enquanto o navegador estiver aberto
setPersistence(auth, browserSessionPersistence);

/* =======================
   AUTH
======================= */
export function login(email, senha) {
    return signInWithEmailAndPassword(auth, email, senha);
}

export function logout() {
    return signOut(auth);
}

export function verificarLogin(callback) {
    return onAuthStateChanged(auth, callback);
}

/* =======================
   FIRESTORE - FUNCIONÁRIOS (Coleção principal)
======================= */

// Gera número aleatório 00001–99999
function gerarNumeroFuncionario() {
    return String(
        Math.floor(Math.random() * 99999) + 1
    ).padStart(5, "0");
}

// Verifica se o número já existe
async function numeroFuncionarioExiste(numero) {
    const q = query(
        collection(db, "funcionarios"),
        where("numero", "==", numero)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

export async function adicionarFuncionarioComNumero(nome, extras = {}) {
    let numero;
    let existe = true;

    while (existe) {
        numero = gerarNumeroFuncionario();
        existe = await numeroFuncionarioExiste(numero);
    }

    // Adiciona o funcionário
    await addDoc(collection(db, "funcionarios"), {
        nome,
        numero,
        status: "Ativo",
        ativo: true,
        ...extras,
        criadoEm: serverTimestamp()
    });

    // Atualiza o contador no dashboard
    try {
        await atualizarContadorFuncionarios();
    } catch (error) {
        console.error("Erro ao atualizar dashboard:", error);
        // Não impede o cadastro do funcionário
    }

    return numero;
}
// Listagem em tempo real de funcionários
export function listarFuncionariosTempoReal(callback) {
    const q = query(
        collection(db, "funcionarios"),
        orderBy("numero")
    );

    return onSnapshot(q, (snapshot) => {
        const funcionarios = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        callback(funcionarios);
    });
}

// 🔍 Buscar funcionários por nome (uso pontual – autocomplete)
export async function buscarFuncionariosPorNomeOnce(nome) {
    const q = query(
        collection(db, "funcionarios"),
        where("nome", ">=", nome),
        where("nome", "<=", nome + "\uf8ff"),
        limit(10)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}


// Buscar funcionário por ID
export async function buscarFuncionarioPorId(id) {
    const ref = doc(db, "funcionarios", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
    }

    return null;
}

// Editar funcionário
export async function editarFuncionario(id, novosDados) {
    await updateDoc(doc(db, "funcionarios", id), novosDados);
}

// Excluir funcionário
export async function excluirFuncionario(id) {
    await deleteDoc(doc(db, "funcionarios", id));
}

// Buscar funcionários por nome (para autocomplete)
export function buscarFuncionariosPorNome(nome, callback) {
    const funcionariosRef = collection(db, "funcionarios");
    const q = query(
        funcionariosRef, 
        where("nome", ">=", nome), 
        where("nome", "<=", nome + "\uf8ff")
    );
    
    onSnapshot(q, (snapshot) => {
        const funcionarios = [];
        snapshot.forEach((doc) => {
            funcionarios.push({ id: doc.id, ...doc.data() });
        });
        callback(funcionarios);
    });
}

/* =======================
   FUNÇÕES PARA DASHBOARD
======================= */

export function monitorarEstatisticasDashboard(callback) {
    const ref = doc(db, "dashboard", "estatisticas");

    return onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            callback({
                totalFuncionarios: 0,
                totalAtivos: 0,
                totalInativos: 0
            });
        }
    });
}



// Atualizar contador de funcionários
export async function atualizarContadorFuncionarios() {
    const dashboardRef = doc(db, "dashboard", "estatisticas");

    try {
        await updateDoc(dashboardRef, {
            totalFuncionarios: increment(1),
            totalAtivos: increment(1),
            atualizadoEm: serverTimestamp()
        });
    } catch (error) {
        // Se o documento não existir, cria
        await setDoc(dashboardRef, {
            totalFuncionarios: 1,
            totalAtivos: 1,
            totalInativos: 0,
            atualizadoEm: serverTimestamp()
        });
    }
}


// Obter estatísticas do dashboard
export async function obterEstatisticasDashboard() {
    try {
        const dashboardRef = doc(db, "dashboard", "estatisticas");
        const dashboardSnap = await getDoc(dashboardRef);
        
        if (dashboardSnap.exists()) {
            return dashboardSnap.data();
        } else {
            // Retorna valores padrão se não existir
            return {
                totalFuncionarios: 0,
                totalAtivos: 0,
                totalInativos: 0
            };
        }
    } catch (error) {
        console.error("Erro ao obter estatísticas:", error);
        return {
            totalFuncionarios: 0,
            totalAtivos: 0,
            totalInativos: 0
        };
    }
}

// 2. Obter totais financeiros do mês atual
export async function obterTotaisMes(mesReferencia) {
    try {
        const q = query(
            collection(db, "pagamentos_descontos"),
            where("mesReferencia", "==", mesReferencia)
        );
        
        const snapshot = await getDocs(q);
        
        let totalPago = 0;
        let totalDescontado = 0;
        
        snapshot.forEach(doc => {
            const transacao = doc.data();
            const valor = transacao.valorTotal || transacao.valorUnitario || 0;
            
            if (transacao.tipo === 'pagamento') {
                totalPago += valor;
            } else if (transacao.tipo === 'desconto') {
                totalDescontado += valor;
            }
        });
        
        return {
            totalPago,
            totalDescontado,
            totalTransacoes: snapshot.size
        };
        
    } catch (error) {
        console.error("Erro ao obter totais do mês:", error);
        return { totalPago: 0, totalDescontado: 0, totalTransacoes: 0 };
    }
}

// 3. Obter últimas transações
export async function obterUltimasTransacoes(limite = 8) {
    try {
        const q = query(
            collection(db, "pagamentos_descontos"),
            orderBy("dataRegistro", "desc"),
            limit(limite)
        );
        
        const snapshot = await getDocs(q);
        const transacoes = [];
        
        snapshot.forEach(doc => {
            transacoes.push({ id: doc.id, ...doc.data() });
        });
        
        return transacoes;
        
    } catch (error) {
        console.error("Erro ao obter últimas transações:", error);
        return [];
    }
}

// 4. Monitorar transações em tempo real para atualização automática
export function monitorarUltimasTransacoes(callback, limite = 8) {
    const q = query(
        collection(db, "pagamentos_descontos"),
        orderBy("dataRegistro", "desc"),
        limit(limite)
    );
    
    return onSnapshot(q, (snapshot) => {
        const transacoes = [];
        snapshot.forEach(doc => {
            transacoes.push({ id: doc.id, ...doc.data() });
        });
        callback(transacoes);
    });
}

/* =======================
   FIRESTORE - PAGAMENTOS E DESCONTOS
======================= */

// Registrar pagamento/desconto
export async function registrarPagamentoDesconto(registro) {
    try {
        const docRef = await addDoc(collection(db, "pagamentos_descontos"), {
            ...registro,
            dataRegistro: new Date().toISOString(),
            timestamp: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Erro ao registrar pagamento/desconto:", error);
        throw error;
    }
}

// Listar registros do mês
export async function listarRegistrosMes(funcionarioNumero, mesReferencia) {
    try {
        const q = query(
            collection(db, "pagamentos_descontos"),
            where("funcionarioNumero", "==", funcionarioNumero),
            where("mesReferencia", "==", mesReferencia)
        );
        
        const querySnapshot = await getDocs(q);
        const registros = [];
        
        querySnapshot.forEach((doc) => {
            registros.push({ id: doc.id, ...doc.data() });
        });
        
        return registros;
    } catch (error) {
        console.error("Erro ao listar registros:", error);
        throw error;
    }
}

/* =======================
   FIRESTORE - CONFIGURAÇÕES
======================= */
export async function adicionarSerie(nomeSerie) {
    try {
        const docRef = await addDoc(collection(db, "series"), {
            nome: nomeSerie,
            disciplinas: [],
            criadoEm: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Erro ao adicionar série:", error);
        throw error;
    }
}

export async function adicionarDisciplina(serieId, nomeDisciplina) {
    try {
        const serieRef = doc(db, "series", serieId);
        const serieSnap = await getDoc(serieRef);
        
        if (serieSnap.exists()) {
            const serie = serieSnap.data();
            const disciplinas = serie.disciplinas || [];
            
            if (!disciplinas.includes(nomeDisciplina)) {
                disciplinas.push(nomeDisciplina);
                await updateDoc(serieRef, { disciplinas });
            }
        }
    } catch (error) {
        console.error("Erro ao adicionar disciplina:", error);
        throw error;
    }
}

export async function listarSeriesComDisciplinas() {
    try {
        const snapshot = await getDocs(collection(db, "series"));
        const series = [];
        
        snapshot.forEach(doc => {
            series.push({ id: doc.id, ...doc.data() });
        });
        
        return series;
    } catch (error) {
        console.error("Erro ao listar séries:", error);
        return [];
    }
}

/* =======================
   FIRESTORE - HOLERITES
======================= */
export async function criarHolerite(holerite) {
    await addDoc(collection(db, "holerites"), {
        ...holerite,
        criadoEm: serverTimestamp()
    });
}

export async function listarHolerites() {
    const snapshot = await getDocs(collection(db, "holerites"));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}