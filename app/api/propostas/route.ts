import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function getFornecedorId(userId: string): Promise<string | null> {
    if (!supabaseAdmin) return null;
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('fornecedor_id')
        .eq('id', userId)
        .single();
    if (userData?.fornecedor_id) return userData.fornecedor_id;

    const { data: fornecedorData } = await supabaseAdmin
        .from('fornecedores')
        .select('id')
        .eq('user_id', userId)
        .single();
    return fornecedorData?.id || null;
}

// POST: Create a proposal (proposta) for a cotação
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'create') {
            const fornecedorId = await getFornecedorId(user.id);
            if (!fornecedorId) {
                return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
            }

            const {
                cotacao_id,
                valor_total,
                valor_frete,
                condicoes_pagamento,
                observacoes,
                data_validade,
                itens
            } = body;

            if (!cotacao_id || !itens || !Array.isArray(itens)) {
                return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
            }

            // Verify cotação exists and is open
            const { data: cotacao } = await supabaseAdmin
                .from('cotacoes')
                .select('id, status, user_id')
                .eq('id', cotacao_id)
                .single();

            if (!cotacao) {
                return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 });
            }

            // Check if fornecedor already responded
            const { data: existing } = await supabaseAdmin
                .from('propostas')
                .select('id')
                .eq('cotacao_id', cotacao_id)
                .eq('fornecedor_id', fornecedorId)
                .limit(1);

            if (existing && existing.length > 0) {
                return NextResponse.json({ error: 'Você já enviou uma proposta para esta cotação' }, { status: 409 });
            }

            // 1. Create proposta
            const { data: proposta, error: propostaError } = await supabaseAdmin
                .from('propostas')
                .insert({
                    cotacao_id,
                    fornecedor_id: fornecedorId,
                    status: 'enviada',
                    valor_total: valor_total || 0,
                    valor_frete: valor_frete || 0,
                    prazo_entrega: null,
                    condicoes_pagamento: condicoes_pagamento || null,
                    observacoes: observacoes || null,
                    data_envio: new Date().toISOString(),
                    data_validade: data_validade || null
                })
                .select()
                .single();

            if (propostaError) {
                console.error('Erro ao criar proposta:', propostaError);
                return NextResponse.json({ error: propostaError.message }, { status: 500 });
            }

            // 2. Create proposta_itens
            const propostaItens = itens.map((item: any) => ({
                proposta_id: proposta.id,
                cotacao_item_id: item.cotacao_item_id,
                preco_unitario: item.preco_unitario || 0,
                quantidade: item.quantidade,
                subtotal: item.subtotal || 0,
                disponibilidade: item.disponibilidade || 'indisponivel',
                prazo_dias: item.prazo_dias ?? -1,
                observacao: item.observacao || null
            }));

            const { error: itensError } = await supabaseAdmin
                .from('proposta_itens')
                .insert(propostaItens);

            if (itensError) {
                console.error('Erro ao criar proposta_itens:', itensError);
                // Rollback proposta
                await supabaseAdmin.from('propostas').delete().eq('id', proposta.id);
                return NextResponse.json({ error: itensError.message }, { status: 500 });
            }

            // 3. Update cotação status to 'respondida' (only if still 'enviada')
            await supabaseAdmin
                .from('cotacoes')
                .update({ status: 'respondida' })
                .eq('id', cotacao_id)
                .eq('status', 'enviada');

            // 4. Create notification for the client
            if (cotacao.user_id) {
                // Get fornecedor name
                const { data: fornecedor } = await supabaseAdmin
                    .from('fornecedores')
                    .select('nome_fantasia, razao_social')
                    .eq('id', fornecedorId)
                    .single();

                const supplierName = fornecedor?.nome_fantasia || fornecedor?.razao_social || 'Um fornecedor';

                await supabaseAdmin
                    .from('notificacoes')
                    .insert({
                        user_id: cotacao.user_id,
                        titulo: 'Nova Proposta Recebida',
                        mensagem: `${supplierName} enviou uma proposta para sua cotação.`,
                        tipo: 'success',
                        lida: false,
                        link: '/dashboard/cliente'
                    });
            }

            return NextResponse.json({ success: true, data: proposta });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API propostas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
