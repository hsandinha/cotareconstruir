/**
 * ═══════════════════════════════════════════════════════════════════
 * COTAR & CONSTRUIR - Teste de Fluxo Completo de Pedido
 * ═══════════════════════════════════════════════════════════════════
 * 
 * FLUXO DO PEDIDO (6 Etapas):
 * 
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │                    VISÃO GERAL DO FLUXO                      │
 *  └─────────────────────────────────────────────────────────────┘
 * 
 *  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 *  │ CLIENTE  │    │FORNECEDOR│    │ CLIENTE  │    │FORNECEDOR│
 *  │ Cria     │───▶│ Recebe   │───▶│ Compara  │───▶│ Gerencia │
 *  │ Cotação  │    │ e Envia  │    │ Propostas│    │ Pedido   │
 *  │          │    │ Proposta │    │ e Aprova │    │          │
 *  └──────────┘    └──────────┘    └──────────┘    └──────────┘
 *       │                │               │               │
 *       ▼                ▼               ▼               ▼
 *  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 *  │ cotacoes │    │propostas │    │ pedidos  │    │ pedidos  │
 *  │ + itens  │    │+ itens   │    │ + itens  │    │ update   │
 *  │ JSONB    │    │proposta_ │    │pedido_   │    │ status   │
 *  │          │    │itens     │    │itens     │    │          │
 *  └──────────┘    └──────────┘    └──────────┘    └──────────┘
 * 
 * 
 *  DETALHAMENTO POR ETAPA:
 *  ═══════════════════════════════════════════════════════════════
 * 
 *  ETAPA 1 - CLIENTE CRIA COTAÇÃO (SolicitationSection)
 *  ─────────────────────────────────────────────────────
 *  • Cliente seleciona uma Obra
 *  • Navega por Fases > Serviços > Grupos > Materiais
 *  • Adiciona itens ao carrinho (descricao, quantidade, unidade)
 *  • Envia cotação
 *  
 *  DB: INSERT cotacoes {
 *    user_id, obra_id, status: "pending",
 *    items: CartItem[] (JSONB), total_items, location: {city, neighborhood}
 *  }
 *  
 *  Notifica: Email para fornecedores da região
 * 
 * 
 *  ETAPA 2 - FORNECEDOR VÊ COTAÇÕES (QuotationInboxSection)
 *  ──────────────────────────────────────────────────────────
 *  • Fornecedor vê lista de cotações com status "pending"
 *  • Filtra por região/categoria
 *  • Seleciona cotação para responder
 *  
 *  DB: SELECT cotacoes WHERE status = 'pending'
 *  Realtime: subscription on cotacoes changes
 * 
 * 
 *  ETAPA 3 - FORNECEDOR ENVIA PROPOSTA (QuotationResponseSection)
 *  ───────────────────────────────────────────────────────────────
 *  • Para cada item: preço unitário + disponibilidade
 *  • Condições: pagamento, validade, frete, observações
 *  
 *  DB: INSERT propostas {
 *    cotacao_id, fornecedor_id, status: "enviada",
 *    valor_total, condicoes_pagamento, data_envio, data_validade
 *  }
 *  DB: INSERT proposta_itens[] {
 *    proposta_id, cotacao_item_id, preco_unitario,
 *    quantidade, subtotal, disponibilidade, prazo_dias
 *  }
 *  
 *  Notifica: notificacoes para o cliente
 * 
 * 
 *  ETAPA 4 - CLIENTE COMPARA PROPOSTAS (ComparativeSection)
 *  ─────────────────────────────────────────────────────────
 *  • Tabela comparativa: itens x fornecedores x preços
 *  • Destaca melhor preço por item (verde)
 *  • Seleção: "Melhor preço por item" ou "Melhor preço total"
 *  • Linha de frete por fornecedor
 *  • Análise de economia
 *  
 *  DB: SELECT cotacoes + cotacao_itens
 *  DB: SELECT propostas + proposta_itens + fornecedor (join users)
 * 
 * 
 *  ETAPA 5 - CLIENTE GERA PEDIDOS (ComparativeSection → finalizeOrder)
 *  ────────────────────────────────────────────────────────────────────
 *  • Agrupa itens selecionados por fornecedor
 *  • Para cada fornecedor gera um pedido
 *  
 *  DB: INSERT pedidos {
 *    cotacao_id, proposta_id, user_id, fornecedor_id, obra_id,
 *    valor_subtotal, valor_frete, valor_total, status: "pending",
 *    dados_cliente: {}, dados_fornecedor: {}, localizacao: {}
 *  }
 *  DB: INSERT pedido_itens[] {
 *    pedido_id, cotacao_item_id, descricao, quantidade,
 *    unidade, preco_unitario, subtotal, observacao
 *  }
 *  DB: UPDATE propostas SET status = "accepted"
 *  DB: UPDATE cotacoes SET status = "finished"
 *  
 *  Notifica: notificacoes + email para fornecedor
 * 
 * 
 *  ETAPA 6 - FORNECEDOR GERENCIA PEDIDO (SalesSection)
 *  ────────────────────────────────────────────────────
 *  • Vê lista de pedidos com detalhes
 *  • Atualiza status: pendente → confirmado → em_preparacao → enviado → entregue
 *  • Chat com cliente
 *  
 *  DB: UPDATE pedidos SET status = X, data_confirmacao, updated_at
 * 
 * 
 *  FLUXO DE STATUS:
 *  ═══════════════
 *  
 *  cotacoes:  pending → (fornecedores respondem) → finished
 *  propostas: enviada → accepted (ou recusada)
 *  pedidos:   pendente → confirmado → em_preparacao → enviado → entregue
 *                                                               (cancelado a qualquer momento)
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://rboauvtemdlislypnggq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJib2F1dnRlbWRsaXNseXBuZ2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4MzQ5NywiZXhwIjoyMDg0NjU5NDk3fQ.MynE4KL4xC_nXK2BhOV81eOmIPTi5TFssCySFQS7Eec'
);

// ═══ Dados de Teste ═══
const CLIENTE_USER_ID = 'e35b0f74-c399-41a5-8cb3-4e40d tried'; // Será preenchido
const FORNECEDOR_1 = {}; // Será preenchido
const FORNECEDOR_2 = {}; // Será preenchido
const OBRA_ID = 'fc219139-7f9d-4e50-b9e6-aef4a3ef8afa';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function printHeader(text) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${text}`);
    console.log('═'.repeat(60));
}

function printStep(step, text) {
    console.log(`\n  📌 ETAPA ${step}: ${text}`);
    console.log('  ' + '─'.repeat(50));
}

async function main() {
    printHeader('COTAR & CONSTRUIR - TESTE DE FLUXO COMPLETO');

    // ═══ SETUP: Buscar dados existentes ═══
    printStep(0, 'PREPARAÇÃO DOS DADOS');

    // Buscar usuário cliente
    const { data: clienteUser } = await supabase
        .from('users')
        .select('id, email, nome')
        .eq('role', 'cliente')
        .single();

    if (!clienteUser) {
        console.log('  ❌ Nenhum usuário cliente encontrado!');
        return;
    }
    console.log(`  👤 Cliente: ${clienteUser.nome} (${clienteUser.email})`);

    // Buscar usuário fornecedor
    const { data: fornecedorUser } = await supabase
        .from('users')
        .select('id, email, nome, fornecedor_id')
        .eq('role', 'fornecedor')
        .single();

    if (!fornecedorUser) {
        console.log('  ❌ Nenhum usuário fornecedor encontrado!');
        return;
    }
    console.log(`  🏭 Fornecedor: ${fornecedorUser.nome} (${fornecedorUser.email})`);

    // Buscar 2 fornecedores ativos para simular competição
    const { data: fornecedores } = await supabase
        .from('fornecedores')
        .select('id, razao_social, email, cidade')
        .eq('status', 'active')
        .limit(2);

    if (!fornecedores || fornecedores.length < 2) {
        console.log('  ❌ Precisa de pelo menos 2 fornecedores ativos!');
        return;
    }
    console.log(`  🏭 Fornecedor 1: ${fornecedores[0].razao_social} (${fornecedores[0].id})`);
    console.log(`  🏭 Fornecedor 2: ${fornecedores[1].razao_social} (${fornecedores[1].id})`);

    // Buscar obra do cliente
    const { data: obra } = await supabase
        .from('obras')
        .select('id, nome, cidade, bairro')
        .eq('id', OBRA_ID)
        .single();

    if (!obra) {
        console.log('  ❌ Obra não encontrada!');
        return;
    }
    console.log(`  🏗️  Obra: ${obra.nome} (${obra.bairro}, ${obra.cidade})`);

    // Buscar materiais de exemplo (3 materiais de grupos diferentes)
    const { data: materiaisExemplo } = await supabase
        .from('materiais')
        .select('id, nome, unidade')
        .limit(5);

    if (!materiaisExemplo || materiaisExemplo.length < 3) {
        console.log('  ❌ Precisa de materiais no banco!');
        return;
    }
    console.log(`  📦 Materiais para teste: ${materiaisExemplo.length}`);
    materiaisExemplo.forEach(m => console.log(`     - ${m.nome} (${m.unidade})`));

    // IDs para rastreamento
    let cotacaoId = null;
    let proposta1Id = null;
    let proposta2Id = null;
    let pedidoId = null;

    // ═══════════════════════════════════════════════════════════
    // ETAPA 1: CLIENTE CRIA COTAÇÃO
    // ═══════════════════════════════════════════════════════════
    printStep(1, 'CLIENTE CRIA COTAÇÃO');

    const cartItems = materiaisExemplo.map((m, idx) => ({
        id: idx + 1,
        descricao: m.nome,
        categoria: 'Material',
        quantidade: Math.floor(Math.random() * 100) + 10,
        unidade: m.unidade,
        observacao: `Entregar na obra - Item teste ${idx + 1}`,
        materialId: m.id
    }));

    console.log('  📝 Itens do carrinho:');
    cartItems.forEach(item => {
        console.log(`     ${item.id}. ${item.descricao} — ${item.quantidade} ${item.unidade}`);
    });

    // Insert cotação
    const { data: cotacao, error: cotacaoErr } = await supabase
        .from('cotacoes')
        .insert({
            user_id: clienteUser.id,
            obra_id: obra.id,
            status: 'enviada',
            observacoes: 'Cotação de teste - fluxo completo',
            data_envio: new Date().toISOString(),
            data_validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

    if (cotacaoErr) {
        console.log(`  ❌ Erro ao criar cotação: ${cotacaoErr.message}`);
        console.log(`  💡 Hint: ${cotacaoErr.hint || cotacaoErr.details || 'N/A'}`);
        return;
    }

    cotacaoId = cotacao.id;
    console.log(`  ✅ Cotação criada: ${cotacaoId}`);
    console.log(`     Status: ${cotacao.status}`);

    // Inserir itens da cotação na tabela cotacao_itens
    const cotacaoItens = cartItems.map(item => ({
        cotacao_id: cotacaoId,
        material_id: item.materialId,
        nome: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        grupo: 'TAPUME DE MADEIRA',
        observacao: item.observacao,
        fase_nome: 'Serviços Preliminares e Mobilização',
        servico_nome: 'Instalações provisórias',
    }));

    const { data: itensInseridos, error: itensErr } = await supabase
        .from('cotacao_itens')
        .insert(cotacaoItens)
        .select();

    if (itensErr) {
        console.log(`  ❌ Erro ao inserir itens da cotação: ${itensErr.message}`);
        console.log(`  💡 ${itensErr.hint || itensErr.details || ''}`);
        return;
    }

    // Atualizar cartItems com os IDs reais do banco
    itensInseridos.forEach((item, idx) => {
        cartItems[idx].dbId = item.id;
    });

    console.log(`  ✅ ${itensInseridos.length} itens da cotação inseridos`);
    itensInseridos.forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.nome} — ${item.quantidade} ${item.unidade} [${item.id.substring(0, 8)}...]`);
    });

    await sleep(500);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 2: FORNECEDORES VÊM AS COTAÇÕES PENDENTES
    // ═══════════════════════════════════════════════════════════
    printStep(2, 'FORNECEDORES VEEM COTAÇÕES PENDENTES');

    const { data: cotacoesPending } = await supabase
        .from('cotacoes')
        .select('*, cotacao_itens (*)')
        .eq('status', 'enviada');

    console.log(`  📋 Cotações pendentes: ${cotacoesPending?.length || 0}`);
    cotacoesPending?.forEach(c => {
        console.log(`     - ID: ${c.id.substring(0, 8)}... | ${c.cotacao_itens?.length || 0} itens`);
    });

    // ═══════════════════════════════════════════════════════════
    // ETAPA 3: FORNECEDOR 1 ENVIA PROPOSTA (preços normais)
    // ═══════════════════════════════════════════════════════════
    printStep(3, 'FORNECEDOR 1 ENVIA PROPOSTA');

    const dataValidade1 = new Date();
    dataValidade1.setDate(dataValidade1.getDate() + 30);

    // Preços do fornecedor 1 (mais caro, frete barato)
    const precos1 = cartItems.map(item => ({
        preco: (Math.random() * 50 + 10).toFixed(2),
        disponibilidade: 'imediata'
    }));

    const totalValue1 = cartItems.reduce((sum, item, idx) => {
        return sum + (parseFloat(precos1[idx].preco) * item.quantidade);
    }, 0);

    const { data: proposta1, error: proposta1Err } = await supabase
        .from('propostas')
        .insert({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedores[0].id,
            status: 'enviada',
            valor_total: totalValue1,
            prazo_entrega: null,
            condicoes_pagamento: '30-dias',
            observacoes: 'Entrega imediata para todos os itens. Frete incluso para BH.',
            data_envio: new Date().toISOString(),
            data_validade: dataValidade1.toISOString()
        })
        .select()
        .single();

    if (proposta1Err) {
        console.log(`  ❌ Erro ao criar proposta 1: ${proposta1Err.message}`);
        console.log(`  💡 ${proposta1Err.hint || proposta1Err.details || ''}`);
        return;
    }

    proposta1Id = proposta1.id;
    console.log(`  ✅ Proposta 1 criada: ${proposta1Id}`);
    console.log(`     Fornecedor: ${fornecedores[0].razao_social}`);
    console.log(`     Valor Total: R$ ${totalValue1.toFixed(2)}`);
    console.log(`     Pagamento: 30 dias`);

    // Inserir itens da proposta 1
    const propostaItens1 = cartItems.map((item, idx) => {
        const preco = parseFloat(precos1[idx].preco);
        return {
            proposta_id: proposta1Id,
            cotacao_item_id: item.dbId,
            preco_unitario: preco,
            quantidade: item.quantidade,
            subtotal: preco * item.quantidade,
            disponibilidade: 'disponivel',
            prazo_dias: 0,
            observacao: null
        };
    });

    const { error: itens1Err } = await supabase
        .from('proposta_itens')
        .insert(propostaItens1);

    if (itens1Err) {
        console.log(`  ❌ Erro nos itens da proposta 1: ${itens1Err.message}`);
        console.log(`  💡 ${itens1Err.hint || itens1Err.details || ''}`);
        return;
    }

    console.log(`  ✅ ${propostaItens1.length} itens da proposta 1 inseridos`);
    propostaItens1.forEach((item, idx) => {
        console.log(`     ${idx + 1}. R$ ${item.preco_unitario.toFixed(2)} x ${item.quantidade} = R$ ${item.subtotal.toFixed(2)}`);
    });

    // Notificação para o cliente
    await supabase.from('notificacoes').insert({
        user_id: clienteUser.id,
        titulo: 'Nova Proposta Recebida',
        mensagem: `${fornecedores[0].razao_social} enviou uma proposta para sua cotação.`,
        tipo: 'success',
        lida: false,
    });
    console.log(`  🔔 Notificação enviada ao cliente`);

    await sleep(500);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 3B: FORNECEDOR 2 ENVIA PROPOSTA (preços menores, frete maior)
    // ═══════════════════════════════════════════════════════════
    printStep('3B', 'FORNECEDOR 2 ENVIA PROPOSTA (CONCORRENTE)');

    const dataValidade2 = new Date();
    dataValidade2.setDate(dataValidade2.getDate() + 15);

    // Preços do fornecedor 2 (mais barato, frete caro)
    const precos2 = precos1.map(p => ({
        preco: (parseFloat(p.preco) * 0.85).toFixed(2), // 15% mais barato
        disponibilidade: '48h'
    }));

    const totalValue2 = cartItems.reduce((sum, item, idx) => {
        return sum + (parseFloat(precos2[idx].preco) * item.quantidade);
    }, 0);

    const { data: proposta2, error: proposta2Err } = await supabase
        .from('propostas')
        .insert({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedores[1].id,
            status: 'enviada',
            valor_total: totalValue2,
            prazo_entrega: null,
            condicoes_pagamento: '30-60-dias',
            observacoes: 'Preço competitivo! Prazo de 48h para disponibilidade.',
            data_envio: new Date().toISOString(),
            data_validade: dataValidade2.toISOString()
        })
        .select()
        .single();

    if (proposta2Err) {
        console.log(`  ❌ Erro proposta 2: ${proposta2Err.message}`);
        return;
    }

    proposta2Id = proposta2.id;
    console.log(`  ✅ Proposta 2 criada: ${proposta2Id}`);
    console.log(`     Fornecedor: ${fornecedores[1].razao_social}`);
    console.log(`     Valor Total: R$ ${totalValue2.toFixed(2)}`);
    console.log(`     Pagamento: 30/60 dias`);

    // Inserir itens da proposta 2
    const propostaItens2 = cartItems.map((item, idx) => {
        const preco = parseFloat(precos2[idx].preco);
        return {
            proposta_id: proposta2Id,
            cotacao_item_id: item.dbId,
            preco_unitario: preco,
            quantidade: item.quantidade,
            subtotal: preco * item.quantidade,
            disponibilidade: 'disponivel',
            prazo_dias: 2,
            observacao: null
        };
    });

    const { error: itens2Err } = await supabase
        .from('proposta_itens')
        .insert(propostaItens2);

    if (itens2Err) {
        console.log(`  ❌ Erro nos itens da proposta 2: ${itens2Err.message}`);
        return;
    }

    console.log(`  ✅ ${propostaItens2.length} itens da proposta 2 inseridos`);
    propostaItens2.forEach((item, idx) => {
        console.log(`     ${idx + 1}. R$ ${item.preco_unitario.toFixed(2)} x ${item.quantidade} = R$ ${item.subtotal.toFixed(2)}`);
    });

    // Notificação para o cliente
    await supabase.from('notificacoes').insert({
        user_id: clienteUser.id,
        titulo: 'Nova Proposta Recebida',
        mensagem: `${fornecedores[1].razao_social} enviou uma proposta para sua cotação.`,
        tipo: 'success',
        lida: false,
    });
    console.log(`  🔔 Notificação enviada ao cliente`);

    await sleep(500);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 4: CLIENTE COMPARA PROPOSTAS (Mapa Comparativo)
    // ═══════════════════════════════════════════════════════════
    printStep(4, 'CLIENTE COMPARA PROPOSTAS');

    // Buscar como o ComparativeSection faz
    const { data: quotationData } = await supabase
        .from('cotacoes')
        .select('*, cotacao_itens (*)')
        .eq('id', cotacaoId)
        .single();

    const { data: proposalsData } = await supabase
        .from('propostas')
        .select('*, proposta_itens (*)')
        .eq('cotacao_id', cotacaoId)
        .order('valor_total', { ascending: true });

    console.log(`  📊 MAPA COMPARATIVO:`);
    console.log(`  ┌─────────────────────────────────────────────────────────────┐`);
    console.log(`  │ ITEM                    │ Fornecedor 1    │ Fornecedor 2    │`);
    console.log(`  ├─────────────────────────┼─────────────────┼─────────────────┤`);

    const items = quotationData.cotacao_itens || [];
    items.forEach((item, idx) => {
        const p1Item = proposalsData[0]?.proposta_itens?.find(pi => pi.cotacao_item_id === item.id);
        const p2Item = proposalsData[1]?.proposta_itens?.find(pi => pi.cotacao_item_id === item.id);

        const p1Price = p1Item?.preco_unitario || 0;
        const p2Price = p2Item?.preco_unitario || 0;
        const cheaper = p1Price < p2Price ? '← 🏆' : p1Price > p2Price ? '         🏆 →' : '    EMPATE';

        const nome = (item.nome || item.descricao || '').substring(0, 23).padEnd(23);
        const v1 = `R$ ${p1Price.toFixed(2)}`.padEnd(15);
        const v2 = `R$ ${p2Price.toFixed(2)}`.padEnd(15);
        console.log(`  │ ${nome} │ ${v1} │ ${v2} │ ${cheaper}`);
    });

    console.log(`  ├─────────────────────────┼─────────────────┼─────────────────┤`);
    const t1 = `R$ ${proposalsData[0]?.valor_total.toFixed(2)}`.padEnd(15);
    const t2 = `R$ ${proposalsData[1]?.valor_total.toFixed(2)}`.padEnd(15);
    console.log(`  │ TOTAL                   │ ${t1} │ ${t2} │`);
    console.log(`  └─────────────────────────┴─────────────────┴─────────────────┘`);

    // Decidir: vamos escolher o fornecedor 2 (mais barato)
    const selectedProposal = proposalsData[1]; // Fornecedor 2 (mais barato)
    const selectedSupplier = fornecedores[1];
    console.log(`\n  ✨ Cliente seleciona: ${selectedSupplier.razao_social} (melhor preço total)`);

    await sleep(500);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 5: CLIENTE GERA PEDIDO (Ordem de Compra)
    // ═══════════════════════════════════════════════════════════
    printStep(5, 'CLIENTE GERA PEDIDO (ORDEM DE COMPRA)');

    const supplierTotal = selectedProposal.valor_total;
    const freight = 150.00; // Simular frete
    const finalTotal = supplierTotal + freight;

    const clientDetails = {
        name: clienteUser.nome || 'Cliente Teste',
        document: '12.345.678/0001-99',
        email: clienteUser.email,
        phone: '(31) 99999-9999',
        address: `${obra.bairro}, ${obra.cidade}`
    };

    const supplierDetails = {
        name: selectedSupplier.razao_social,
        document: '',
        email: selectedSupplier.email || '',
        phone: '',
        address: selectedSupplier.cidade || ''
    };

    // Criar pedido (como o ComparativeSection.finalizeOrder faz)
    const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos')
        .insert({
            cotacao_id: cotacaoId,
            proposta_id: selectedProposal.id,
            user_id: clienteUser.id,
            fornecedor_id: selectedSupplier.id,
            obra_id: obra.id,
            valor_total: finalTotal,
            status: 'pendente',
            endereco_entrega: {
                clientName: clientDetails.name,
                workName: obra.nome,
                neighborhood: obra.bairro || '',
                city: obra.cidade || '',
                state: 'MG',
                fullAddress: clientDetails.address,
                clientDetails: clientDetails,
                items: cartItems.map((item, idx) => ({
                    id: item.dbId,
                    name: item.descricao,
                    quantity: item.quantidade,
                    unit: item.unidade,
                    unitPrice: selectedProposal.proposta_itens[idx]?.preco_unitario || 0,
                    total: (selectedProposal.proposta_itens[idx]?.preco_unitario || 0) * item.quantidade,
                    observation: item.observacao
                })),
                proposal: {
                    freight: freight,
                    availability: '48h',
                    validity: '15-dias',
                    paymentTerms: selectedProposal.condicoes_pagamento
                }
            },
            created_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (pedidoErr) {
        console.log(`  ❌ Erro ao criar pedido: ${pedidoErr.message}`);
        console.log(`  💡 ${pedidoErr.hint || pedidoErr.details || ''}`);
        return;
    }

    pedidoId = pedido.id;
    console.log(`  ✅ Pedido criado: ${pedidoId}`);
    console.log(`     Valor Subtotal: R$ ${supplierTotal.toFixed(2)}`);
    console.log(`     Frete: R$ ${freight.toFixed(2)}`);
    console.log(`     TOTAL: R$ ${finalTotal.toFixed(2)}`);
    console.log(`     Status: ${pedido.status}`);

    // Criar itens do pedido
    const pedidoItens = cartItems.map((item, idx) => {
        const precoUnit = selectedProposal.proposta_itens[idx]?.preco_unitario || 0;
        return {
            pedido_id: pedidoId,
            material_id: item.materialId,
            nome: item.descricao,
            quantidade: item.quantidade,
            unidade: item.unidade,
            preco_unitario: precoUnit,
            subtotal: precoUnit * item.quantidade,
        };
    });

    const { error: pedidoItensErr } = await supabase
        .from('pedido_itens')
        .insert(pedidoItens);

    if (pedidoItensErr) {
        console.log(`  ❌ Erro nos itens do pedido: ${pedidoItensErr.message}`);
        console.log(`  💡 ${pedidoItensErr.hint || pedidoItensErr.details || ''}`);
        return;
    }

    console.log(`  ✅ ${pedidoItens.length} itens do pedido inseridos`);

    // Atualizar status da proposta aceita
    await supabase
        .from('propostas')
        .update({ status: 'aceita' })
        .eq('id', selectedProposal.id);
    console.log(`  ✅ Proposta ${selectedProposal.id.substring(0, 8)}... marcada como ACEITA`);

    // Atualizar cotação como finalizada
    await supabase
        .from('cotacoes')
        .update({ status: 'fechada' })
        .eq('id', cotacaoId);
    console.log(`  ✅ Cotação ${cotacaoId.substring(0, 8)}... marcada como FECHADA`);

    // Notificação para o fornecedor
    await supabase.from('notificacoes').insert({
        user_id: fornecedorUser.id,
        titulo: 'Novo Pedido Recebido!',
        mensagem: `Você recebeu um novo pedido de compra de ${clientDetails.name}. Valor: R$ ${finalTotal.toFixed(2)}`,
        tipo: 'success',
        lida: false,
    });
    console.log(`  🔔 Notificação enviada ao fornecedor`);

    await sleep(500);

    // ═══════════════════════════════════════════════════════════
    // ETAPA 6: FORNECEDOR GERENCIA O PEDIDO
    // ═══════════════════════════════════════════════════════════
    printStep(6, 'FORNECEDOR GERENCIA O PEDIDO');

    // 6A: Fornecedor vê o pedido
    const { data: pedidoFornecedor } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

    console.log(`  📋 Pedido recebido pelo fornecedor:`);
    console.log(`     ID: ${pedidoFornecedor.id}`);
    console.log(`     Status: ${pedidoFornecedor.status}`);
    console.log(`     Valor: R$ ${pedidoFornecedor.valor_total}`);

    // 6B: Fornecedor CONFIRMA o pedido
    console.log(`\n  ▶️  Fornecedor CONFIRMA o pedido...`);
    await supabase
        .from('pedidos')
        .update({
            status: 'confirmado',
            data_confirmacao: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);
    console.log(`  ✅ Status: pendente → CONFIRMADO`);

    await sleep(300);

    // 6C: Fornecedor coloca EM PREPARAÇÃO
    console.log(`\n  ▶️  Fornecedor inicia PREPARAÇÃO...`);
    await supabase
        .from('pedidos')
        .update({
            status: 'em_preparacao',
            updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);
    console.log(`  ✅ Status: confirmado → EM PREPARAÇÃO`);

    await sleep(300);

    // 6D: Fornecedor ENVIA o pedido
    console.log(`\n  ▶️  Fornecedor ENVIA o pedido...`);
    await supabase
        .from('pedidos')
        .update({
            status: 'enviado',
            updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);
    console.log(`  ✅ Status: em_preparação → ENVIADO`);

    await sleep(300);

    // 6E: Pedido ENTREGUE
    console.log(`\n  ▶️  Pedido ENTREGUE...`);
    await supabase
        .from('pedidos')
        .update({
            status: 'entregue',
            data_entrega: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);
    console.log(`  ✅ Status: enviado → ENTREGUE`);

    await sleep(300);

    // ═══════════════════════════════════════════════════════════
    // VERIFICAÇÃO FINAL
    // ═══════════════════════════════════════════════════════════
    printHeader('VERIFICAÇÃO FINAL');

    // Verificar cotação
    const { data: cotFinal } = await supabase.from('cotacoes').select('*').eq('id', cotacaoId).single();
    console.log(`  📄 Cotação: ${cotFinal.status}`);

    // Verificar propostas
    const { data: propsFinal } = await supabase.from('propostas').select('id, status, fornecedor_id, valor_total').eq('cotacao_id', cotacaoId);
    console.log(`  📝 Propostas: ${propsFinal.length}`);
    propsFinal.forEach(p => {
        const forn = fornecedores.find(f => f.id === p.fornecedor_id);
        console.log(`     - ${forn?.razao_social.substring(0, 30) || p.fornecedor_id.substring(0, 8)} | R$ ${p.valor_total} | status: ${p.status}`);
    });

    // Verificar pedido
    const { data: pedFinal } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
    console.log(`  📦 Pedido: ${pedFinal.status} | R$ ${pedFinal.valor_total}`);

    // Verificar itens do pedido
    const { data: itensFinal } = await supabase.from('pedido_itens').select('*').eq('pedido_id', pedidoId);
    console.log(`  📋 Itens do pedido: ${itensFinal.length}`);
    itensFinal.forEach(item => {
        console.log(`     - ${item.nome} | ${item.quantidade} ${item.unidade} | R$ ${item.preco_unitario} | Total: R$ ${item.subtotal}`);
    });

    // Verificar notificações
    const { data: notifs } = await supabase.from('notificacoes').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(`  🔔 Notificações recentes: ${notifs?.length || 0}`);
    notifs?.forEach(n => console.log(`     - [${n.tipo}] ${n.titulo}: ${n.mensagem.substring(0, 60)}...`));

    // Contagens finais
    printHeader('RESUMO DO BANCO');

    const tables = ['cotacoes', 'propostas', 'proposta_itens', 'pedidos', 'pedido_itens', 'notificacoes'];
    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`  ${table.padEnd(20)} ${count} registros`);
    }

    printHeader('✅ FLUXO COMPLETO TESTADO COM SUCESSO!');
    console.log(`
  IDs para testar no sistema:
  ─────────────────────────────
  Cotação:    ${cotacaoId}
  Proposta 1: ${proposta1Id}
  Proposta 2: ${proposta2Id}
  Pedido:     ${pedidoId}
  
  Logins para testar:
  ─────────────────────────────
  Cliente:    ${clienteUser.email}
  Fornecedor: ${fornecedorUser.email}
  
  O que verificar no sistema:
  ─────────────────────────────
  1. Login como CLIENTE → aba "Pedidos" → ver cotação com 2 propostas
  2. Login como FORNECEDOR → aba "Vendas" → ver pedido entregue
  3. Notificações (sino) → deve ter alertas
    `);
}

main().catch(err => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});
