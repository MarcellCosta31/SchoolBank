import { 
    listarFuncionariosTempoReal, 
    registrarPagamentoDesconto,
    buscarFuncionariosPorNome,
    listarRegistrosMes
} from "../firebase.js";

// Dados das opções
const opcoesPagamento = [
    { id: 'assiduidade', nome: 'Adicional Assiduidade', valor: 50, tipo: 'pagamento', icon: 'fa-calendar-check' },
    { id: 'pontualidade', nome: 'Adicional Pontualidade', valor: 50, tipo: 'pagamento', icon: 'fa-clock' },
    { id: 'ilibado', nome: 'Adicional Ilibado', valor: 100, tipo: 'pagamento', icon: 'fa-award' },
    { id: 'monitor', nome: 'Adicional Monitor', valor: 200, tipo: 'pagamento', icon: 'fa-chalkboard-teacher' },
    { id: 'desempenho1', nome: 'Adicional Desempenho I', valor: 100, tipo: 'pagamento', icon: 'fa-star' },
    { id: 'desempenho2', nome: 'Adicional Desempenho II', valor: 200, tipo: 'pagamento', icon: 'fa-star' },
    { id: 'desempenho3', nome: 'Adicional Desempenho III', valor: 300, tipo: 'pagamento', icon: 'fa-star' },
    { id: 'media_maxima', nome: 'Média Máxima', valor: 50, tipo: 'pagamento', icon: 'fa-chart-line', observacaoObrigatoria: true }
];

const opcoesDesconto = [
    { id: 'suspensao', nome: 'Suspensão', valor: 300, tipo: 'desconto', icon: 'fa-ban' },
    { id: 'falta', nome: 'Falta sem Justificativa', valor: 10, tipo: 'desconto', icon: 'fa-user-slash', quantidadeObrigatoria: true },
    { id: 'atraso', nome: 'Atraso', valor: 5, tipo: 'desconto', icon: 'fa-hourglass-half', quantidadeObrigatoria: true },
    { id: 'ma_conduta', nome: 'Má Conduta', valor: 20, tipo: 'desconto', icon: 'fa-exclamation-triangle', quantidadeObrigatoria: true },
    { id: 'recuperacao', nome: 'Recuperação', valor: 20, tipo: 'desconto', icon: 'fa-redo', quantidadeObrigatoria: true },
    { id: 'reprovacao', nome: 'Reprovação', valor: 50, tipo: 'desconto', icon: 'fa-times-circle', quantidadeObrigatoria: true },
    { id: 'media_zero', nome: 'Média Zero', valor: 100, tipo: 'desconto', icon: 'fa-chart-line' }
];

// Estado atual
let funcionarios = [];
let funcionarioSelecionado = null;
let tipoAtual = 'pagamento';
let opcoesSelecionadas = [];
let quantidadeCache = {};

// Elementos DOM
const funcionarioInput = document.getElementById('funcionarioInput');
const sugestoesContainer = document.getElementById('sugestoesFuncionario');
const btnPagamento = document.getElementById('btnPagamento');
const btnDesconto = document.getElementById('btnDesconto');
const opcoesContainer = document.getElementById('opcoesContainer');
const opcoesLabel = document.getElementById('opcoesLabel');
const totalCalculado = document.getElementById('totalCalculado');
const btnRegistrar = document.getElementById('btnRegistrar');
const mesReferencia = document.getElementById('mesReferencia');
const observacao = document.getElementById('observacao');
const totalPagamentos = document.getElementById('totalPagamentos');
const totalDescontos = document.getElementById('totalDescontos');
const totalFinal = document.getElementById('totalFinal');
const historicoContainer = document.getElementById('historicoContainer');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const btnCancelar = document.getElementById('btnCancelar');
const btnConfirmar = document.getElementById('btnConfirmar');

// Configurar mês atual como padrão
const hoje = new Date();
const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
mesReferencia.value = mesAtual;

// Inicializar
function init() {
    carregarFuncionarios();
    configurarEventos();
    atualizarOpcoes();
    carregarResumoMes();
    carregarHistorico();
}

// Carregar funcionários
async function carregarFuncionarios() {
    listarFuncionariosTempoReal((funcs) => {
        funcionarios = funcs;
    });
}

// Configurar eventos
function configurarEventos() {
    // Busca de funcionários
    funcionarioInput.addEventListener('input', buscarFuncionarios);
    funcionarioInput.addEventListener('focus', handleInputFocus);
    funcionarioInput.addEventListener('blur', handleInputBlur);
    
    // Tipo de registro
    btnPagamento.addEventListener('click', () => alterarTipo('pagamento'));
    btnDesconto.addEventListener('click', () => alterarTipo('desconto'));
    
    // Mês de referência
    mesReferencia.addEventListener('change', () => {
        carregarResumoMes();
        carregarHistorico();
    });
    
    // Registrar
    btnRegistrar.addEventListener('click', prepararRegistro);
    
    // Modal
    btnCancelar.addEventListener('click', fecharModal);
    btnConfirmar.addEventListener('click', confirmarRegistro);
    
    // Fechar sugestões ao clicar fora
    document.addEventListener('click', handleClickOutside);
    
    // Fechar modal com ESC
    document.addEventListener('keydown', handleKeyDown);
}

// Buscar funcionários
function buscarFuncionarios() {
    const termo = funcionarioInput.value.toLowerCase().trim();
    
    sugestoesContainer.style.display = 'none';
    
    if (termo.length < 2) {
        sugestoesContainer.innerHTML = '';
        funcionarioSelecionado = null;
        return;
    }
    
    const resultados = funcionarios.filter(func => 
        func.nome.toLowerCase().includes(termo) || 
        (func.numero && func.numero.toString().includes(termo))
    );
    
    mostrarSugestoes(resultados);
}

// Mostrar sugestões
function mostrarSugestoes(funcs) {
    sugestoesContainer.innerHTML = '';
    
    if (funcs.length === 0) {
        sugestoesContainer.innerHTML = '<div class="sugestao-item">Nenhum funcionário encontrado</div>';
        sugestoesContainer.style.display = 'block';
        return;
    }
    
    funcs.slice(0, 5).forEach(func => {
        const div = document.createElement('div');
        div.className = 'sugestao-item';
        div.innerHTML = `
            <i class="fas fa-user"></i>
            <div class="sugestao-info">
                <strong>${func.nome}</strong>
                <small>Matrícula: ${func.numero || 'N/A'}</small>
            </div>
        `;
        
        div.addEventListener('click', () => {
            funcionarioInput.value = func.nome;
            funcionarioSelecionado = func;
            sugestoesContainer.innerHTML = '';
            sugestoesContainer.style.display = 'none';
            carregarResumoMes();
            carregarHistorico();
        });
        
        sugestoesContainer.appendChild(div);
    });
    
    sugestoesContainer.style.display = 'block';
}

// Alterar tipo (pagamento/desconto)
function alterarTipo(tipo) {
    tipoAtual = tipo;
    
    // Atualizar botões
    btnPagamento.classList.toggle('tipo-ativo', tipo === 'pagamento');
    btnDesconto.classList.toggle('tipo-ativo', tipo === 'desconto');
    
    // Atualizar label
    opcoesLabel.innerHTML = `<i class="fas fa-list-check"></i> Opções de ${tipo === 'pagamento' ? 'Pagamento' : 'Desconto'}`;
    
    // Atualizar opções
    atualizarOpcoes();
    
    // Limpar seleções
    opcoesSelecionadas = [];
    atualizarTotal();
}

// Atualizar opções disponíveis
function atualizarOpcoes() {
    opcoesContainer.innerHTML = '';
    
    const opcoes = tipoAtual === 'pagamento' ? opcoesPagamento : opcoesDesconto;
    
    opcoes.forEach(opcao => {
        const div = document.createElement('div');
        div.className = 'opcao-item';
        div.innerHTML = `
            <div class="opcao-info">
                <input type="checkbox" id="${opcao.id}" data-id="${opcao.id}" data-valor="${opcao.valor}">
                <label for="${opcao.id}">
                    <i class="fas ${opcao.icon}"></i>
                    ${opcao.nome}
                </label>
                <span class="opcao-valor ${opcao.tipo}">${opcao.tipo === 'pagamento' ? '+' : '-'} R$ ${opcao.valor.toFixed(2)}</span>
            </div>
            ${opcao.quantidadeObrigatoria || opcao.observacaoObrigatoria ? `
                <div class="opcao-extra" style="display: none;">
                    ${opcao.quantidadeObrigatoria ? `
                        <input type="number" 
                               min="1" 
                               max="100" 
                               placeholder="Quantidade" 
                               class="quantidade-input"
                               data-id="${opcao.id}">
                    ` : ''}
                    ${opcao.observacaoObrigatoria ? `
                        <input type="text" 
                               placeholder="Notas 10 no monitor" 
                               class="obs-input"
                               data-id="${opcao.id}">
                    ` : ''}
                </div>
            ` : ''}
        `;
        
        const checkbox = div.querySelector('input[type="checkbox"]');
        const extraDiv = div.querySelector('.opcao-extra');
        
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                opcoesSelecionadas.push(opcao);
                if (extraDiv) {
                    extraDiv.style.display = 'flex';
                    const input = extraDiv.querySelector('input');
                    if (input) {
                        input.focus();
                        input.addEventListener('input', atualizarTotal);
                    }
                }
            } else {
                opcoesSelecionadas = opcoesSelecionadas.filter(o => o.id !== opcao.id);
                if (extraDiv) {
                    extraDiv.style.display = 'none';
                    const input = extraDiv.querySelector('input');
                    if (input) {
                        input.value = '';
                        delete quantidadeCache[opcao.id];
                    }
                }
            }
            atualizarTotal();
        });
        
        // Quantidade input
        const quantidadeInput = div.querySelector('.quantidade-input');
        if (quantidadeInput) {
            quantidadeInput.addEventListener('input', function() {
                const qtd = parseInt(this.value) || 0;
                quantidadeCache[opcao.id] = qtd;
                atualizarTotal();
            });
        }
        
        // Observação input
        const obsInput = div.querySelector('.obs-input');
        if (obsInput) {
            obsInput.addEventListener('input', function() {
                quantidadeCache[opcao.id] = this.value.trim();
                atualizarTotal();
            });
        }
        
        opcoesContainer.appendChild(div);
    });
}

// Atualizar total calculado
function atualizarTotal() {
    let total = 0;
    
    opcoesSelecionadas.forEach(opcao => {
        let valor = opcao.valor;
        
        // Calcular baseado na quantidade se necessário
        if (opcao.quantidadeObrigatoria && quantidadeCache[opcao.id]) {
            valor *= quantidadeCache[opcao.id];
        } else if (opcao.observacaoObrigatoria && quantidadeCache[opcao.id]) {
            const qtd = parseInt(quantidadeCache[opcao.id]) || 0;
            valor = 50 * qtd;
        }
        
        total += (opcao.tipo === 'pagamento' ? valor : -valor);
    });
    
    const formatado = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    totalCalculado.textContent = formatado;
    
    // Atualizar cor
    const span = document.querySelector('.total-display span');
    if (span) {
        span.className = total >= 0 ? 'positivo' : 'negativo';
    }
}

// Preparar registro
function prepararRegistro() {
    if (!funcionarioSelecionado) {
        alert('Selecione um funcionário!');
        funcionarioInput.focus();
        return;
    }
    
    if (opcoesSelecionadas.length === 0) {
        alert('Selecione pelo menos uma opção!');
        return;
    }
    
    // Verificar campos obrigatórios
    for (const opcao of opcoesSelecionadas) {
        if ((opcao.quantidadeObrigatoria || opcao.observacaoObrigatoria) && 
            (!quantidadeCache[opcao.id] || quantidadeCache[opcao.id] === '')) {
            const campo = opcao.quantidadeObrigatoria ? 'quantidade' : 'observação';
            alert(`Preencha a ${campo} para "${opcao.nome}"`);
            return;
        }
    }
    
    // Calcular valores e criar descrição
    let total = 0;
    let descricao = '';
    
    opcoesSelecionadas.forEach(opcao => {
        let valor = opcao.valor;
        let detalhe = '';
        
        if (opcao.quantidadeObrigatoria && quantidadeCache[opcao.id]) {
            detalhe = ` (${quantidadeCache[opcao.id]}x)`;
            valor *= quantidadeCache[opcao.id];
        } else if (opcao.observacaoObrigatoria && quantidadeCache[opcao.id]) {
            detalhe = ` (${quantidadeCache[opcao.id]})`;
            valor = 50 * parseInt(quantidadeCache[opcao.id]) || 0;
        }
        
        descricao += `• ${opcao.nome}${detalhe}: ${opcao.tipo === 'pagamento' ? '+' : '-'}R$ ${valor.toFixed(2)}\n`;
        total += (opcao.tipo === 'pagamento' ? valor : -valor);
    });
    
    // Mostrar modal de confirmação
    confirmMessage.innerHTML = `
        <p><strong>Funcionário:</strong> ${funcionarioSelecionado.nome}</p>
        <p><strong>Matrícula:</strong> ${funcionarioSelecionado.numero || 'N/A'}</p>
        <p><strong>Mês:</strong> ${formatarMesReferencia(mesReferencia.value)}</p>
        <p><strong>Tipo:</strong> ${tipoAtual === 'pagamento' ? 'Pagamento' : 'Desconto'}</p>
        <p><strong>Total:</strong> <span class="${total >= 0 ? 'positivo' : 'negativo'}">R$ ${Math.abs(total).toFixed(2)}</span></p>
        <p><strong>Observação:</strong> ${observacao.value || 'Nenhuma'}</p>
        <p><strong>Detalhes:</strong></p>
        <pre>${descricao}</pre>
    `;
    
    confirmModal.style.display = 'flex';
}

// Formatar mês de referência
function formatarMesReferencia(mesString) {
    if (!mesString) return '';
    const [ano, mes] = mesString.split('-');
    return `${mes}/${ano}`;
}

// Fechar modal
function fecharModal() {
    confirmModal.style.display = 'none';
}

// Confirmar registro
async function confirmarRegistro() {
    try {
        const registros = opcoesSelecionadas.map(opcao => {
            const registro = {
                funcionarioNumero: funcionarioSelecionado.numero,
                funcionarioNome: funcionarioSelecionado.nome,
                tipo: tipoAtual,
                opcaoId: opcao.id,
                opcaoNome: opcao.nome,
                valorUnitario: opcao.valor,
                mesReferencia: mesReferencia.value,
                dataRegistro: new Date().toISOString(),
                timestamp: new Date().getTime()
            };
            
            // Adicionar quantidade ou observação se necessário
            if (opcao.quantidadeObrigatoria && quantidadeCache[opcao.id]) {
                registro.quantidade = quantidadeCache[opcao.id];
                registro.valorTotal = opcao.valor * quantidadeCache[opcao.id];
                registro.descricao = `${quantidadeCache[opcao.id]}x`;
            } else if (opcao.observacaoObrigatoria && quantidadeCache[opcao.id]) {
                registro.quantidade = quantidadeCache[opcao.id];
                registro.valorTotal = 50 * parseInt(quantidadeCache[opcao.id]) || 0;
                registro.descricao = `Notas 10: ${quantidadeCache[opcao.id]}`;
            } else {
                registro.valorTotal = opcao.valor;
            }
            
            if (observacao.value.trim()) {
                registro.observacao = observacao.value.trim();
            }
            
            return registro;
        });
        
        // Registrar no Firebase
        for (const registro of registros) {
            await registrarPagamentoDesconto(registro);
        }
        
        alert('Registro realizado com sucesso!');
        fecharModal();
        limparFormulario();
        carregarResumoMes();
        carregarHistorico();
        
    } catch (error) {
        console.error('Erro ao registrar:', error);
        alert('Erro ao realizar registro: ' + error.message);
    }
}

// Limpar formulário
function limparFormulario() {
    funcionarioInput.value = '';
    funcionarioSelecionado = null;
    sugestoesContainer.innerHTML = '';
    sugestoesContainer.style.display = 'none';
    opcoesSelecionadas = [];
    quantidadeCache = {};
    observacao.value = '';
    
    // Desmarcar checkboxes
    document.querySelectorAll('.opcao-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Ocultar extras
    document.querySelectorAll('.opcao-extra').forEach(div => {
        div.style.display = 'none';
    });
    
    atualizarTotal();
}

// Carregar resumo do mês
async function carregarResumoMes() {
    if (!funcionarioSelecionado || !mesReferencia.value) {
        // Resetar valores padrão
        totalPagamentos.textContent = 'R$ 0,00';
        totalDescontos.textContent = 'R$ 0,00';
        totalFinal.textContent = 'R$ 1.000,00';
        totalFinal.className = 'resumo-valor positivo';
        return;
    }
    
    try {
        const registros = await listarRegistrosMes(funcionarioSelecionado.numero, mesReferencia.value);
        
        let totalPagos = 0;
        let totalDescontados = 0;
        
        registros.forEach(reg => {
            if (reg.tipo === 'pagamento') {
                totalPagos += reg.valorTotal || reg.valorUnitario || 0;
            } else {
                totalDescontados += reg.valorTotal || reg.valorUnitario || 0;
            }
        });
        
        const salarioBase = 1000;
        const final = salarioBase + totalPagos - totalDescontados;
        
        totalPagamentos.textContent = totalPagos.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        totalDescontos.textContent = totalDescontados.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        totalFinal.textContent = final.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        totalFinal.className = final >= 0 ? 'resumo-valor positivo' : 'resumo-valor negativo';
        
    } catch (error) {
        console.error('Erro ao carregar resumo:', error);
        alert('Erro ao carregar resumo do mês');
    }
}

// Carregar histórico
async function carregarHistorico() {
    if (!funcionarioSelecionado || !mesReferencia.value) {
        historicoContainer.innerHTML = '<p class="vazio">Selecione um funcionário para visualizar o histórico.</p>';
        return;
    }
    
    try {
        const registros = await listarRegistrosMes(funcionarioSelecionado.numero, mesReferencia.value);
        
        if (registros.length === 0) {
            historicoContainer.innerHTML = '<p class="vazio">Nenhum registro encontrado para este mês.</p>';
            return;
        }
        
        historicoContainer.innerHTML = '';
        
        registros.sort((a, b) => new Date(b.dataRegistro || b.timestamp) - new Date(a.dataRegistro || a.timestamp));
        
        registros.forEach(reg => {
            const div = document.createElement('div');
            div.className = 'historico-item';
            
            const data = reg.dataRegistro ? new Date(reg.dataRegistro) : new Date(reg.timestamp);
            const dataFormatada = data.toLocaleDateString('pt-BR');
            const horaFormatada = data.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const valor = reg.valorTotal || reg.valorUnitario || 0;
            
            div.innerHTML = `
                <div class="historico-icon ${reg.tipo}">
                    <i class="fas ${reg.tipo === 'pagamento' ? 'fa-plus' : 'fa-minus'}"></i>
                </div>
                <div class="historico-info">
                    <strong>${reg.opcaoNome}</strong>
                    ${reg.descricao ? `<small>${reg.descricao}</small>` : ''}
                    ${reg.observacao ? `<small class="observacao">${reg.observacao}</small>` : ''}
                    <small>${dataFormatada} às ${horaFormatada}</small>
                </div>
                <div class="historico-valor ${reg.tipo}">
                    ${reg.tipo === 'pagamento' ? '+' : '-'}R$ ${valor.toFixed(2)}
                </div>
            `;
            
            historicoContainer.appendChild(div);
        });
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        historicoContainer.innerHTML = '<p class="vazio">Erro ao carregar histórico.</p>';
    }
}

// Handlers para eventos

function handleInputFocus() {
    const termo = funcionarioInput.value.toLowerCase().trim();
    if (termo.length >= 2) {
        buscarFuncionarios();
    }
}

function handleInputBlur() {
    // Pequeno delay para permitir clique na sugestão
    setTimeout(() => {
        // Verifica se o mouse não está sobre as sugestões
        if (!sugestoesContainer.matches(':hover')) {
            sugestoesContainer.style.display = 'none';
        }
    }, 150);
}
function handleClickOutside(event) {
    const isClickInsideFuncionarioInput = funcionarioInput.contains(event.target);
    const isClickInsideSugestoes = sugestoesContainer.contains(event.target);
    
    if (!isClickInsideFuncionarioInput && !isClickInsideSugestoes) {
        sugestoesContainer.style.display = 'none';
    }
}

function handleKeyDown(event) {
    if (event.key === 'Escape') {
        if (confirmModal.style.display === 'flex') {
            fecharModal();
        }
    }
}

// Inicializar quando DOM carregado
document.addEventListener('DOMContentLoaded', init);

// Exportar funções necessárias para uso global
window.alterarTipo = alterarTipo;
window.prepararRegistro = prepararRegistro;
window.confirmarRegistro = confirmarRegistro;
window.fecharModal = fecharModal;
window.limparFormulario = limparFormulario;