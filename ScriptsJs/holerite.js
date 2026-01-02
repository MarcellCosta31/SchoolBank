// Importando funções do Firebase
import { 
    db,
    listarRegistrosMes,
    criarHolerite,
    buscarFuncionariosPorNome
} from "../firebase.js";

let pagamentos = [];
let descontos = [];
let funcionarioSelecionado = null;
let timeoutBusca = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    configurarDataPadrao();
    configurarAutocomplete();
    
    // Adicionar eventos
    document.getElementById('funcionarioInput').addEventListener('input', buscarFuncionarios);
    document.getElementById('mesReferencia').addEventListener('change', atualizarBotoes);
    
    // Fechar sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        const sugestoes = document.getElementById('sugestoesFuncionario');
        if (!e.target.closest('#funcionarioInput') && !e.target.closest('#sugestoesFuncionario')) {
            sugestoes.style.display = 'none';
        }
    });
});

function configurarDataPadrao() {
    const hoje = new Date();
    const mesAtual = hoje.toISOString().slice(0, 7); // YYYY-MM
    document.getElementById('mesReferencia').value = mesAtual;
}

function configurarAutocomplete() {
    const input = document.getElementById('funcionarioInput');
    const sugestoes = document.getElementById('sugestoesFuncionario');
    
    input.addEventListener('focus', () => {
        if (input.value.length >= 2) {
            buscarFuncionarios();
        }
    });
    
    // Teclado - navegação nas sugestões
    input.addEventListener('keydown', (e) => {
        const items = sugestoes.querySelectorAll('.sugestoes-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                items[0].focus();
            }
        }
    });
}

function buscarFuncionarios() {
    const termo = document.getElementById('funcionarioInput').value.trim();
    const sugestoes = document.getElementById('sugestoesFuncionario');
    
    if (termo.length < 2) {
        sugestoes.style.display = 'none';
        return;
    }
    
    // Debounce para evitar muitas requisições
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(async () => {
        try {
            // Usar a função do Firebase para buscar funcionários
            buscarFuncionariosPorNome(termo, (funcionariosEncontrados) => {
                mostrarSugestoes(funcionariosEncontrados);
            });
        } catch (error) {
            console.error('Erro ao buscar funcionários:', error);
            sugestoes.style.display = 'none';
        }
    }, 300);
}

function mostrarSugestoes(funcionariosLista) {
    const sugestoes = document.getElementById('sugestoesFuncionario');
    sugestoes.innerHTML = '';
    
    if (funcionariosLista.length === 0) {
        const item = document.createElement('div');
        item.className = 'sugestoes-item';
        item.textContent = 'Nenhum funcionário encontrado';
        sugestoes.appendChild(item);
    } else {
        funcionariosLista.forEach(funcionario => {
            const item = document.createElement('div');
            item.className = 'sugestoes-item';
            item.innerHTML = `
                <div>
                    <span class="sugestoes-nome">${funcionario.nome}</span>
                    <span class="sugestoes-matricula">Matrícula: ${funcionario.numero}</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                selecionarFuncionario(funcionario);
            });
            
            sugestoes.appendChild(item);
        });
    }
    
    sugestoes.style.display = 'block';
}

function selecionarFuncionario(funcionario) {
    const input = document.getElementById('funcionarioInput');
    const sugestoes = document.getElementById('sugestoesFuncionario');
    
    input.value = `${funcionario.nome} (Matrícula: ${funcionario.numero})`;
    document.getElementById('funcionarioId').value = funcionario.id;
    document.getElementById('funcionarioNumero').value = funcionario.numero;
    
    funcionarioSelecionado = funcionario;
    sugestoes.style.display = 'none';
    
    atualizarBotoes();
}

function atualizarBotoes() {
    const funcionarioId = document.getElementById('funcionarioId').value;
    const mes = document.getElementById('mesReferencia').value;
    const btnPrevisualizar = document.getElementById('btnPrevisualizar');
    const btnGerarPDF = document.getElementById('btnGerarPDF');
    
    btnPrevisualizar.disabled = !funcionarioId || !mes;
    // Só desabilitar PDF se não tiver funcionário ou mês
    btnGerarPDF.disabled = !funcionarioId || !mes;
}

// ===== NOVA FUNÇÃO DE PRÉ-VISUALIZAÇÃO EM NOVA JANELA =====
// ===== NOVA FUNÇÃO DE PRÉ-VISUALIZAÇÃO EM NOVA JANELA =====
window.previsualizar = async () => {
    const funcionarioNumero = document.getElementById('funcionarioNumero').value;
    const mesReferencia = document.getElementById('mesReferencia').value;
    
    if (!funcionarioNumero || !mesReferencia) {
        alert('Selecione um funcionário e um mês referência!');
        return;
    }
    
    if (!funcionarioSelecionado) {
        alert('Funcionário não selecionado corretamente!');
        return;
    }
    
    // Mostrar loader
    document.getElementById('loader').style.display = 'block';
    
    try {
        console.log(`Buscando registros para: ${funcionarioNumero}, Mês: ${mesReferencia}`);
        
        // Buscar TODOS os registros do mês (pagamentos e descontos)
        const registros = await listarRegistrosMes(funcionarioNumero, mesReferencia);
        
        console.log('Registros encontrados:', registros);
        
        // Separar pagamentos e descontos CORRETAMENTE
        pagamentos = registros.filter(r => r.tipo === 'pagamento');
        descontos = registros.filter(r => r.tipo === 'desconto');
        
        // SALÁRIO BASE FIXO
        const SALARIO_BASE = 1000;
        
        // Calcular vantagens adicionais (excluindo possível salário base duplicado)
        const totalVantagensAdicionais = pagamentos.reduce((total, p) => {
            const valor = p.valorTotal || p.valorUnitario || p.valor || 0;
            const descricao = p.descricao || p.opcaoNome || '';
            
            // Se for um pagamento marcado como "salário", não somar como vantagem adicional
            if (descricao.toLowerCase().includes('salário') || descricao.toLowerCase().includes('salario')) {
                return total;
            }
            
            return total + Number(valor);
        }, 0);
        
        // Calcular total de descontos
        const totalDescontos = descontos.reduce((total, d) => {
            const valor = d.valorTotal || d.valorUnitario || d.valor || 0;
            return total + Number(valor);
        }, 0);
        
        // CALCULAR CORRETAMENTE:
        // Total de Proventos = Salário Base + Vantagens Adicionais
        const totalProventos = SALARIO_BASE + totalVantagensAdicionais;
        
        // Valor Líquido = Salário Base + Vantagens Adicionais - Descontos
        const liquido = SALARIO_BASE + totalVantagensAdicionais - totalDescontos;
        
        console.log('Cálculos:');
        console.log('- Salário Base:', SALARIO_BASE);
        console.log('- Vantagens Adicionais:', totalVantagensAdicionais);
        console.log('- Total Proventos:', totalProventos);
        console.log('- Total Descontos:', totalDescontos);
        console.log('- Valor Líquido:', liquido);
        
        // Esconder loader
        document.getElementById('loader').style.display = 'none';
        
        // Abrir pré-visualização em nova janela
        abrirPreviewEmNovaJanela(SALARIO_BASE, totalVantagensAdicionais, totalDescontos, liquido, mesReferencia);
        
        // Habilitar botão de gerar PDF
        document.getElementById('btnGerarPDF').disabled = false;
        
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        document.getElementById('loader').style.display = 'none';
        alert('Erro ao buscar dados do funcionário: ' + error.message);
    }
};

// ===== FUNÇÃO PARA ABRIR PRÉ-VISUALIZAÇÃO EM NOVA JANELA =====
// ===== FUNÇÃO PARA ABRIR PRÉ-VISUALIZAÇÃO EM NOVA JANELA =====
function abrirPreviewEmNovaJanela(salarioBase, vantagensAdicionais, totalDescontos, liquido, mesReferencia) {
    const hoje = new Date();
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    const dataHoraEmissao = hoje.toLocaleString('pt-BR');
    
    // Calcular total de proventos
    const totalProventos = salarioBase + vantagensAdicionais;
    
    // Formatar moeda brasileira
    const formatarMoeda = (valor) => {
        return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2
        });
    };
    
    // Formatar mês referência
    const formatarMes = (mesString) => {
        if (!mesString) return '';
        const [ano, mes] = mesString.split('-');
        const mesNumero = parseInt(mes);
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${meses[mesNumero - 1]} de ${ano}`;
    };
    
    // Criar conteúdo HTML otimizado para impressão
    const conteudoHTML = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Holerite - ${funcionarioSelecionado.nome}</title>
            
            <style>
                /* ESTILOS PARA TELA */
                @media screen {
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        background: #f2f2f2;
                        padding: 10px;
                    }

                    .holerite {
                        background: #fff;
                        width: 210mm; /* A4 width */
                        min-height: 297mm; /* A4 height */
                        margin: 10px auto;
                        padding: 15mm;
                        border: 1px solid #000;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }

                    .controls {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: white;
                        padding: 10px 15px;
                        border-radius: 5px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        z-index: 1000;
                        display: flex;
                        gap: 10px;
                    }

                    .btn {
                        padding: 8px 15px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 13px;
                        font-family: Arial, sans-serif;
                    }

                    .btn:hover {
                        background: #2980b9;
                    }

                    .btn-print {
                        background: #e74c3c;
                    }

                    .btn-print:hover {
                        background: #c0392b;
                    }
                }

                /* ESTILOS COMUNS */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                h1 {
                    text-align: center;
                    font-size: 20px;
                    margin-bottom: 3px;
                    color: #2c3e50;
                }

                .subtitulo {
                    text-align: center;
                    font-size: 14px;
                    margin-bottom: 15px;
                    color: #7f8c8d;
                    font-weight: bold;
                }

                .linha {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    font-size: 12px;
                }

                .bloco {
                    border: 1px solid #ddd;
                    padding: 10px;
                    margin-bottom: 12px;
                    border-radius: 3px;
                    background: #f9f9f9;
                    page-break-inside: avoid;
                }

                .bloco h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    color: #2c3e50;
                    border-bottom: 1px solid #3498db;
                    padding-bottom: 5px;
                    font-size: 14px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    margin-bottom: 5px;
                }

                table th, table td {
                    border: 1px solid #ddd;
                    padding: 5px;
                    text-align: left;
                }

                table th {
                    background: #f0f0f0;
                    font-weight: bold;
                    color: #2c3e50;
                    font-size: 11px;
                }

                table tbody tr:nth-child(even) {
                    background-color: #f8f9fa;
                }

                .total {
                    font-weight: bold;
                    font-size: 12px;
                    color: #2c3e50;
                }

                .total-valor {
                    color: #27ae60;
                    text-align: right;
                }

                .desconto-valor {
                    color: #e74c3c;
                    text-align: right;
                }

                hr {
                    border: none;
                    border-top: 1px solid #ddd;
                    margin: 8px 0;
                }

                .assinaturas {
                    margin-top: 25px;
                    display: flex;
                    justify-content: space-between;
                    padding-top: 15px;
                    border-top: 1px solid #ddd;
                    page-break-inside: avoid;
                }

                .assinatura {
                    width: 45%;
                    text-align: center;
                    padding-top: 40px;
                    position: relative;
                    font-size: 11px;
                }

                .assinatura::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 15%;
                    right: 15%;
                    border-top: 1px solid #000;
                    padding-top: 8px;
                }

                .liquido-section {
                    background: #2c3e50;
                    color: white;
                    padding: 10px;
                    border-radius: 3px;
                    margin: 15px 0;
                    text-align: center;
                    page-break-inside: avoid;
                }

                .liquido-valor {
                    font-size: 18px;
                    font-weight: bold;
                    color: #2ecc71;
                    margin-top: 3px;
                }

                .info-box {
                    background: #e8f4fc;
                    border-left: 3px solid #3498db;
                    padding: 8px;
                    margin: 10px 0;
                    border-radius: 0 3px 3px 0;
                    font-size: 10px;
                    page-break-inside: avoid;
                }
                
                .col-tipo {
                    width: 45%;
                }
                
                .col-multiplicador {
                    width: 20%;
                    text-align: center;
                }
                
                .col-valor {
                    width: 35%;
                    text-align: right;
                }
                
                .valor-unitario {
                    font-size: 9px;
                    color: #666;
                    font-style: italic;
                }

                /* ESTILOS ESPECÍFICOS PARA IMPRESSÃO */
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                    
                    body {
                        background: none;
                        padding: 0;
                        margin: 0;
                        font-size: 12px;
                        width: 100%;
                        height: 100%;
                    }

                    .holerite {
                        border: none;
                        width: 100%;
                        padding: 0;
                        margin: 0;
                        box-shadow: none;
                        min-height: auto;
                    }

                    .controls {
                        display: none !important;
                    }

                    .no-print {
                        display: none !important;
                    }
                    
                    table th {
                        background: #f0f0f0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .total-valor, .desconto-valor {
                        color: #000 !important;
                    }
                    
                    /* Garantir que não haja quebras de página indesejadas */
                    .bloco, table, .assinaturas, .liquido-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    /* Otimizar espaçamento para impressão */
                    .bloco {
                        margin-bottom: 8px;
                        padding: 8px;
                    }
                    
                    table {
                        font-size: 10px;
                    }
                    
                    table th, table td {
                        padding: 4px;
                    }
                    
                    h1 {
                        font-size: 18px;
                        margin-bottom: 2px;
                    }
                    
                    .subtitulo {
                        font-size: 12px;
                        margin-bottom: 10px;
                    }
                    
                    .linha {
                        font-size: 11px;
                        margin-bottom: 4px;
                    }
                    
                    .liquido-valor {
                        font-size: 16px;
                    }
                    
                    .assinatura {
                        padding-top: 30px;
                        font-size: 10px;
                    }
                }

                /* ESTILOS PARA TELAS PEQUENAS */
                @media screen and (max-width: 900px) {
                    .holerite {
                        width: 95%;
                        padding: 10px;
                    }
                }
            </style>
        </head>

        <body>

            <div class="controls no-print">
                <button class="btn btn-print" onclick="window.print()">
                    <i class="fas fa-print"></i> Imprimir / Salvar PDF
                </button>
                <button class="btn" onclick="window.close()">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>

            <div class="holerite">

                <h1>HOLERITE / CONTRACHEQUE</h1>
                <div class="subtitulo">SchoolBank - Sistema de Gestão Escolar</div>

                <!-- Dados da Instituição -->
                <div class="bloco" style="padding: 8px;">
                    <div class="linha">
                        <div><strong>Instituição:</strong> Escola SchoolBank</div>
                        <div><strong>Data de Emissão:</strong> ${dataEmissao}</div>
                    </div>
                </div>

                <!-- Dados do Funcionário -->
                <div class="bloco" style="padding: 8px;">
                    <div class="linha">
                        <div><strong>Funcionário:</strong> ${funcionarioSelecionado.nome || 'N/A'}</div>
                        <div><strong>Matrícula:</strong> ${funcionarioSelecionado.numero || 'N/A'}</div>
                    </div>
                    
                    <div class="linha">
                        <div><strong>Cargo:</strong> ${funcionarioSelecionado.cargo || 'Funcionário'}</div>
                        <div><strong>Período:</strong> ${formatarMes(mesReferencia)}</div>
                    </div>
                </div>

                <!-- SALÁRIO BASE -->
                <div class="bloco" style="padding: 8px;">
                    <h3>Salário Base</h3>
                    <div class="linha" style="font-size: 13px; font-weight: bold;">
                        <div>Salário Base (Valor Fixo)</div>
                        <div class="total-valor">${formatarMoeda(salarioBase)}</div>
                    </div>
                </div>

                <!-- PROVENTOS ADICIONAIS -->
                <div class="bloco" style="padding: 8px;">
                    <h3>Proventos / Vantagens Adicionais</h3>
                    <table>
                        <thead>
                            <tr>
                                <th class="col-tipo">Tipo de Vantagem</th>
                                <th class="col-multiplicador">Multiplicador</th>
                                <th class="col-valor">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagamentos.length > 0 ? pagamentos.map(p => {
                                const valor = p.valorTotal || p.valorUnitario || p.valor || 0;
                                const descricao = p.descricao || p.opcaoNome || 'Vantagem';
                                const quantidade = p.quantidade || 1;
                                const valorUnitario = p.valorUnitario || valor;
                                
                                // Se for o salário base, pular (já mostrado separadamente)
                                if (descricao.toLowerCase().includes('salário') || descricao.toLowerCase().includes('salario')) {
                                    return '';
                                }
                                
                                return `
                                    <tr>
                                        <td>
                                            <div>${descricao}</div>
                                            ${quantidade > 1 ? `<div class="valor-unitario">${formatarMoeda(valorUnitario)} cada</div>` : ''}
                                        </td>
                                        <td class="col-multiplicador">${quantidade > 1 ? `× ${quantidade}` : '-'}</td>
                                        <td class="total-valor">${formatarMoeda(Number(valor))}</td>
                                    </tr>
                                `;
                            }).filter(item => item !== '').join('') : 
                            `<tr>
                                <td colspan="3" style="text-align: center; color: #7f8c8d; font-style: italic;">
                                    Nenhum provento adicional registrado
                                </td>
                            </tr>`
                            }
                            
                            <!-- Total de proventos adicionais -->
                            ${vantagensAdicionais > 0 ? `
                            <tr style="background-color: #e8f5e9; border-top: 2px solid #ddd;">
                                <td colspan="2" style="text-align: right; font-weight: bold; padding-top: 8px;">
                                    Total de Vantagens:
                                </td>
                                <td class="total-valor" style="font-weight: bold; padding-top: 8px;">${formatarMoeda(vantagensAdicionais)}</td>
                            </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>

                <!-- DESCONTOS -->
                <div class="bloco" style="padding: 8px;">
                    <h3>Descontos / Penalidades</h3>
                    <table>
                        <thead>
                            <tr>
                                <th class="col-tipo">Tipo de Desconto</th>
                                <th class="col-multiplicador">Multiplicador</th>
                                <th class="col-valor">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${descontos.length > 0 ? descontos.map(d => {
                                const valor = d.valorTotal || d.valorUnitario || d.valor || 0;
                                const descricao = d.opcaoNome || d.motivo || 'Desconto';
                                const quantidade = d.quantidade || 1;
                                const valorUnitario = d.valorUnitario || valor / Math.max(1, quantidade);
                                
                                return `
                                    <tr>
                                        <td>
                                            <div>${descricao}</div>
                                            ${quantidade > 1 ? `<div class="valor-unitario">${formatarMoeda(valorUnitario)} cada</div>` : ''}
                                        </td>
                                        <td class="col-multiplicador">${quantidade > 1 ? `× ${quantidade}` : '-'}</td>
                                        <td class="desconto-valor">${formatarMoeda(Number(valor))}</td>
                                    </tr>
                                `;
                            }).join('') : 
                            `<tr>
                                <td colspan="3" style="text-align: center; color: #7f8c8d; font-style: italic;">
                                    Nenhum desconto registrado
                                </td>
                            </tr>`
                            }
                            
                            <!-- Total de descontos -->
                            ${totalDescontos > 0 ? `
                            <tr style="background-color: #ffeaea; border-top: 2px solid #ddd;">
                                <td colspan="2" style="text-align: right; font-weight: bold; padding-top: 8px;">
                                    Total de Descontos:
                                </td>
                                <td class="desconto-valor" style="font-weight: bold; padding-top: 8px;">${formatarMoeda(totalDescontos)}</td>
                            </tr>
                            ` : 
                            descontos.length > 0 ? `
                            <tr style="background-color: #ffeaea; border-top: 2px solid #ddd;">
                                <td colspan="2" style="text-align: right; font-weight: bold; padding-top: 8px;">
                                    Total de Descontos:
                                </td>
                                <td class="desconto-valor" style="font-weight: bold; padding-top: 8px;">R$ 0,00</td>
                            </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>

                <!-- RESUMO FINAL -->
                <div class="bloco" style="padding: 8px;">
                    <h3>Resumo Financeiro</h3>
                    
                    <!-- Salário Base -->
                    <div class="linha">
                        <div>Salário Base:</div>
                        <div class="total-valor">${formatarMoeda(salarioBase)}</div>
                    </div>
                    
                    <!-- Vantagens Adicionais -->
                    ${vantagensAdicionais > 0 ? `
                    <div class="linha">
                        <div>Vantagens Adicionais:</div>
                        <div class="total-valor">+ ${formatarMoeda(vantagensAdicionais)}</div>
                    </div>
                    ` : ''}
                    
                    <!-- Descontos -->
                    ${totalDescontos > 0 ? `
                    <div class="linha">
                        <div>Descontos/ Penalidades:</div>
                        <div class="desconto-valor">- ${formatarMoeda(totalDescontos)}</div>
                    </div>
                    ` : ''}
                    
                    <hr style="margin: 6px 0;">
                    
                    <!-- TOTAL BRUTO -->
                    <div class="linha" style="font-weight: bold; font-size: 13px;">
                        <div>Total Bruto (Salário Base + Vantagens):</div>
                        <div class="total-valor">${formatarMoeda(totalProventos)}</div>
                    </div>
                    
                    <!-- VALOR LÍQUIDO -->
                    <div class="liquido-section" style="padding: 10px; margin: 10px 0;">
                        <div style="font-size: 14px; margin-bottom: 5px;">VALOR LÍQUIDO A RECEBER:</div>
                        <div class="liquido-valor">${formatarMoeda(liquido)}</div>
                        <div style="font-size: 10px; margin-top: 3px; opacity: 0.9;">
                            Fórmula: R$ 1.000,00 + Vantagens - Descontos
                        </div>
                    </div>
                </div>

                <!-- LEGENDA DOS TIPOS -->
                <div class="info-box">
                    <div style="font-weight: bold; margin-bottom: 5px; font-size: 11px;">Legenda:</div>
                    <div style="font-size: 10px; line-height: 1.4;">
                        <strong>Vantagens:</strong> Adicional Assiduidade, Pontualidade, Ilibado, Monitor, Desempenho I/II/III, Média Máxima<br>
                        <strong>Descontos:</strong> Suspensão, Falta sem Justificativa, Atraso, Má Conduta, Recuperação, Reprovação, Média Zero
                    </div>
                    <div style="margin-top: 5px; font-size: 9px; color: #666;">
                        * Valores calculados conforme regras do sistema SchoolBank
                    </div>
                </div>

                <!-- Assinaturas -->
                <div class="assinaturas">
                    <div class="assinatura">
                        <div style="font-weight: bold;">${funcionarioSelecionado.nome || 'Funcionário'}</div>
                        <div>Assinatura do Funcionário</div>
                    </div>
                    <div class="assinatura">
                        <div style="font-weight: bold;">SchoolBank</div>
                        <div>Assinatura da Instituição</div>
                    </div>
                </div>

                <!-- Rodapé -->
                <div style="text-align: center; margin-top: 20px; font-size: 9px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 10px;">
                    <div>Documento gerado eletronicamente por SchoolBank - Sistema de Gestão Escolar</div>
                    <div>Data e hora da geração: ${dataHoraEmissao}</div>
                </div>

            </div>

            <!-- Incluir Font Awesome para ícones -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
            
            <script>
                // Configurar impressão automática
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('Holerite carregado com sucesso!');
                    
                    // Configurar eventos de impressão
                    window.addEventListener('beforeprint', function() {
                        console.log('Preparando para impressão...');
                        // Opcional: ajustar layout para impressão
                        document.body.classList.add('printing');
                    });
                    
                    window.addEventListener('afterprint', function() {
                        console.log('Impressão concluída');
                        document.body.classList.remove('printing');
                    });
                    
                    // Configurações de impressão recomendadas
                    const printSettings = {
                        layout: 'portrait',
                        margins: '15mm',
                        scale: 0.95
                    };
                    
                    console.log('Configurações recomendadas para PDF:', printSettings);
                });
            </script>

        </body>
        </html>
    `;
    
    // Abrir nova janela com o conteúdo
    const janelaPreview = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    
    if (!janelaPreview) {
        alert('Permita pop-ups para ver a pré-visualização. Clique em "Gerar PDF" para versão automática.');
        return;
    }
    
    janelaPreview.document.write(conteudoHTML);
    janelaPreview.document.close();
    
    // Focar na nova janela
    janelaPreview.focus();
    
    // Feedback no console
    console.log('✅ Holerite aberto em nova janela otimizado para impressão.');
    console.log('📄 Para melhor resultado ao salvar PDF:');
    console.log('1. Clique em "Imprimir / Salvar PDF"');
    console.log('2. Na caixa de diálogo, escolha "Salvar como PDF"');
    console.log('3. Configurações recomendadas:');
    console.log('   - Layout: Retrato');
    console.log('   - Margens: Padrão ou Mínimo');
    console.log('   - Escala: 95%');
};
// ===== GERAR PDF (mantém a funcionalidade original como fallback) =====
window.gerarPDF = async () => {
    const funcionarioNumero = document.getElementById('funcionarioNumero').value;
    const mesReferencia = document.getElementById('mesReferencia').value;
    
    if (!funcionarioNumero || !mesReferencia) {
        alert('Selecione um funcionário e um mês referência!');
        return;
    }
    
    // Mostrar loader
    document.getElementById('loader').style.display = 'block';
    
    try {
        // Se não tiver dados carregados, pré-visualizar primeiro
        if (!funcionarioSelecionado || pagamentos.length === 0) {
            await carregarDadosParaPDF();
        }
        
        // Calcular totais
        const totalProventos = pagamentos.reduce((total, p) => {
            const valor = p.valorTotal || p.valorUnitario || p.valor || 0;
            return total + Number(valor);
        }, 0);
        
        const totalDescontos = descontos.reduce((total, d) => {
            const valor = d.valorTotal || d.valorUnitario || d.valor || 0;
            return total + Number(valor);
        }, 0);
        
        const liquido = totalProventos - totalDescontos;
        
        console.log('Gerando PDF automático...');
        
        // Usar método simplificado que abre em nova janela para impressão
        await gerarPDFViaNovaJanela(totalProventos, totalDescontos, liquido, mesReferencia);
        
        // Salvar holerite no Firebase
        await salvarHoleriteNoBanco(totalProventos, totalDescontos, liquido, mesReferencia);
        
        // Esconder loader
        document.getElementById('loader').style.display = 'none';
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        document.getElementById('loader').style.display = 'none';
        alert('Erro ao gerar holerite: ' + error.message);
    }
};

// Função auxiliar para carregar dados
async function carregarDadosParaPDF() {
    const funcionarioNumero = document.getElementById('funcionarioNumero').value;
    const mesReferencia = document.getElementById('mesReferencia').value;
    
    console.log(`Carregando dados para PDF: ${funcionarioNumero}, Mês: ${mesReferencia}`);
    
    const registros = await listarRegistrosMes(funcionarioNumero, mesReferencia);
    
    pagamentos = registros.filter(r => r.tipo === 'pagamento');
    descontos = registros.filter(r => r.tipo === 'desconto');
    
    console.log(`Carregados: ${pagamentos.length} pagamentos, ${descontos.length} descontos`);
}

// ===== GERAR PDF VIA NOVA JANELA (método simplificado) =====
async function gerarPDFViaNovaJanela(totalProventos, totalDescontos, liquido, mesReferencia) {
    return new Promise((resolve, reject) => {
        try {
            // Criar uma nova janela com o conteúdo do holerite
            const hoje = new Date();
            const dataEmissao = hoje.toLocaleDateString('pt-BR');
            
            // Conteúdo HTML simplificado para impressão
            const printHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Holerite - ${funcionarioSelecionado.nome}</title>
                    <meta charset="UTF-8">
                    <style>
                        @page {
                            size: A4;
                            margin: 20mm;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            color: #333;
                            font-size: 12px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 2px solid #2c3e50;
                            padding-bottom: 20px;
                        }
                        .header h1 {
                            color: #2c3e50;
                            margin: 0 0 10px 0;
                            font-size: 24px;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .info-box {
                            border: 1px solid #ddd;
                            padding: 15px;
                            border-radius: 4px;
                        }
                        .info-box h3 {
                            color: #2c3e50;
                            margin: 0 0 10px 0;
                            font-size: 14px;
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 5px;
                        }
                        .columns {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .section {
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            overflow: hidden;
                        }
                        .section-title {
                            background: #2c3e50;
                            color: white;
                            padding: 10px;
                            margin: 0;
                            font-size: 14px;
                            text-align: center;
                        }
                        .section-content {
                            padding: 15px;
                        }
                        .item-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 6px 0;
                            border-bottom: 1px dashed #eee;
                            font-size: 11px;
                        }
                        .total-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0;
                            border-top: 2px solid #ddd;
                            font-weight: bold;
                            margin-top: 10px;
                        }
                        .liquido {
                            background: #2c3e50;
                            color: white;
                            padding: 20px;
                            border-radius: 6px;
                            text-align: center;
                            margin: 25px 0;
                        }
                        .liquido-valor {
                            font-size: 28px;
                            font-weight: bold;
                            color: #2ecc71;
                        }
                        .assinatura {
                            text-align: center;
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #333;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            padding-top: 15px;
                            border-top: 1px solid #ddd;
                            font-size: 10px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>HOLERITE DE PAGAMENTO</h1>
                            <p><strong>SCHOOLBANK</strong></p>
                            <p><strong>PERÍODO:</strong> ${formatarMes(mesReferencia)}</p>
                        </div>
                        
                        <div class="info-grid">
                            <div class="info-box">
                                <h3>DADOS DO FUNCIONÁRIO</h3>
                                <p><strong>Nome:</strong> ${funcionarioSelecionado.nome}</p>
                                <p><strong>Matrícula:</strong> ${funcionarioSelecionado.numero}</p>
                                <p><strong>Cargo:</strong> ${funcionarioSelecionado.cargo || 'Funcionário'}</p>
                                <p><strong>Data Emissão:</strong> ${dataEmissao}</p>
                            </div>
                            <div class="info-box">
                                <h3>RESUMO FINANCEIRO</h3>
                                <p><strong>Total Proventos:</strong> R$ ${totalProventos.toFixed(2)}</p>
                                <p><strong>Total Descontos:</strong> R$ ${totalDescontos.toFixed(2)}</p>
                                <p><strong>Valor Líquido:</strong> R$ ${liquido.toFixed(2)}</p>
                            </div>
                        </div>
                        
                        <div class="columns">
                            <div class="section">
                                <h3 class="section-title">PROVENTOS</h3>
                                <div class="section-content">
                                    ${pagamentos.map(p => {
                                        const valor = p.valorTotal || p.valorUnitario || p.valor || 0;
                                        return `<div class="item-row">
                                            <span>${p.descricao || 'Pagamento'}</span>
                                            <span>R$ ${Number(valor).toFixed(2)}</span>
                                        </div>`;
                                    }).join('')}
                                    ${pagamentos.length === 0 ? '<div class="item-row"><span>Nenhum pagamento</span><span>R$ 0,00</span></div>' : ''}
                                    <div class="total-row">
                                        <span>TOTAL PROVENTOS</span>
                                        <span>R$ ${totalProventos.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="section">
                                <h3 class="section-title">DESCONTOS</h3>
                                <div class="section-content">
                                    ${descontos.map(d => {
                                        const valor = d.valorTotal || d.valorUnitario || d.valor || 0;
                                        return `<div class="item-row">
                                            <span>${d.descricao || d.motivo || 'Desconto'}</span>
                                            <span>R$ ${Number(valor).toFixed(2)}</span>
                                        </div>`;
                                    }).join('')}
                                    ${descontos.length === 0 ? '<div class="item-row"><span>Nenhum desconto</span><span>R$ 0,00</span></div>' : ''}
                                    <div class="total-row">
                                        <span>TOTAL DESCONTOS</span>
                                        <span>R$ ${totalDescontos.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="liquido">
                            <h3>VALOR LÍQUIDO A RECEBER</h3>
                            <div class="liquido-valor">R$ ${liquido.toFixed(2)}</div>
                        </div>
                        
                        <div class="assinatura">
                            <p>___________________________________</p>
                            <p>Assinatura do Responsável Financeiro</p>
                        </div>
                        
                        <div class="footer">
                            <p>Documento gerado eletronicamente em ${hoje.toLocaleString('pt-BR')}</p>
                            <p>SchoolBank - Sistema de Gestão Escolar</p>
                        </div>
                    </div>
                    
                    <script>
                        // Imprimir automaticamente quando a página carregar
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                                // Fechar após 2 segundos (tempo para o diálogo de impressão aparecer)
                                setTimeout(() => {
                                    window.close();
                                }, 2000);
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `;
            
            // Abrir nova janela para impressão
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Permita pop-ups para gerar o PDF automaticamente.');
                reject(new Error('Pop-up bloqueado'));
                return;
            }
            
            printWindow.document.write(printHTML);
            printWindow.document.close();
            
            // Resolver quando a janela fechar (aproximadamente)
            setTimeout(() => {
                resolve();
            }, 3000);
            
        } catch (error) {
            console.error('Erro no método de impressão:', error);
            reject(error);
        }
    });
}

// ===== FUNÇÃO PARA SALVAR NO FIREBASE =====
async function salvarHoleriteNoBanco(totalProventos, totalDescontos, liquido, mesReferencia) {
    try {
        if (!funcionarioSelecionado || !funcionarioSelecionado.id) {
            throw new Error('Funcionário inválido');
        }

        const holeriteData = {
            funcionarioId: funcionarioSelecionado.id || '',
            funcionarioNome: funcionarioSelecionado.nome || 'Funcionário não identificado',
            funcionarioNumero: funcionarioSelecionado.numero || '0000',
            funcionarioCargo: funcionarioSelecionado.cargo || 'Funcionário',
            funcionarioStatus: funcionarioSelecionado.status || 'Ativo',
            
            mesReferencia: mesReferencia || '',
            totalProventos: Number(totalProventos) || 0,
            totalDescontos: Number(totalDescontos) || 0,
            valorLiquido: Number(liquido) || 0,
            
            dataGeracao: new Date().toISOString(),
            status: 'gerado',
            
            detalhesPagamentos: Array.isArray(pagamentos) ? pagamentos.map(p => ({
                descricao: p.descricao || 'Pagamento',
                valor: Number(p.valorTotal || p.valorUnitario || p.valor || 0),
                data: p.data || new Date().toISOString(),
                tipo: 'pagamento'
            })) : [],
            
            detalhesDescontos: Array.isArray(descontos) ? descontos.map(d => ({
                descricao: d.descricao || d.motivo || 'Desconto',
                valor: Number(d.valorTotal || d.valorUnitario || d.valor || 0),
                data: d.data || new Date().toISOString(),
                tipo: 'desconto'
            })) : [],
            
            versaoSistema: '1.0.0',
            tipoDocumento: 'holerite'
        };

        // Remover campos undefined
        const holeriteLimpo = {};
        Object.keys(holeriteData).forEach(key => {
            if (holeriteData[key] !== undefined) {
                holeriteLimpo[key] = holeriteData[key];
            }
        });

        console.log('Salvando no Firebase:', holeriteLimpo);
        await criarHolerite(holeriteLimpo);
        console.log('✅ Holerite salvo no Firebase!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
        // Não propagar o erro
    }
}

// ===== FUNÇÕES AUXILIARES =====
function formatarMes(mesString) {
    if (!mesString) return '';
    const [ano, mes] = mesString.split('-');
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const mesIndex = parseInt(mes) - 1;
    if (mesIndex >= 0 && mesIndex < meses.length) {
        return `${meses[mesIndex]} de ${ano}`;
    }
    return `${mes}/${ano}`;
}

// Expor função para debug
window.debugHolerite = function() {
    console.log('=== DEBUG HOLERITE ===');
    console.log('Funcionário:', funcionarioSelecionado);
    console.log('Pagamentos:', pagamentos);
    console.log('Descontos:', descontos);
    console.log('Total Proventos:', pagamentos.reduce((t, p) => t + (Number(p.valor) || 0), 0));
    console.log('Total Descontos:', descontos.reduce((t, d) => t + (Number(d.valor) || 0), 0));
    console.log('=================');
};


// Adicione esta função ao final do holerite.js para testar
function testarPreview() {
    // Dados de exemplo
    funcionarioSelecionado = {
        nome: "João Silva",
        numero: "1234",
        cargo: "Professor",
        status: "Ativo"
    };
    
    pagamentos = [
        { descricao: "Salário", valorTotal: 3000 },
        { descricao: "Hora Extra", valorTotal: 500 }
    ];
    
    descontos = [
        { descricao: "INSS", valorTotal: 200 },
        { descricao: "Vale Transporte", valorTotal: 150 }
    ];
    
    abrirPreviewEmNovaJanela(3500, 350, 3150, "2024-12");
}

// Chame no console do navegador: testarPreview()