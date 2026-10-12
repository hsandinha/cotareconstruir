import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveSupplierAccess } from '@/lib/supplierAccessServer';
import { criarOuAtualizarProposta } from '@/lib/propostaService';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        // Tentar cookies do Supabase (formato: sb-<ref>-auth-token)
        const allCookies = req.cookies.getAll();
        const supabaseAuthCookie = allCookies
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;

        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                // Ignorar erro de parse
            }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
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
            const requestedFornecedorId = typeof body.fornecedor_id === 'string'
                ? body.fornecedor_id
                : null;
            const resolvedAccess = await resolveSupplierAccess(supabaseAdmin, user.id, requestedFornecedorId);
            if (!resolvedAccess.ok) {
                return NextResponse.json(
                    { error: resolvedAccess.error, code: resolvedAccess.code },
                    { status: resolvedAccess.status }
                );
            }

            const fornecedorId = resolvedAccess.fornecedorId;
            if (!fornecedorId) {
                return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
            }

            if (!body.cotacao_id || !Array.isArray(body.itens)) {
                return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
            }

            // Quem enviou a proposta: várias pessoas podem responder pelo
            // mesmo fornecedor, e a Ordem de Compra precisa mostrar o contato
            // (nome), não o e-mail da empresa.
            const { data: autorRow } = await supabaseAdmin
                .from('users')
                .select('nome, email')
                .eq('id', user.id)
                .single();

            const resultado = await criarOuAtualizarProposta({
                cotacaoId: body.cotacao_id,
                fornecedorId,
                autor: { userId: user.id, nome: autorRow?.nome || autorRow?.email || null },
                valorTotal: body.valor_total,
                valorFrete: body.valor_frete,
                valorImpostos: parseFloat(body.valor_impostos),
                valorDesconto: parseFloat(body.valor_desconto),
                prazoEntrega: body.prazo_entrega,
                condicoesPagamento: body.condicoes_pagamento,
                observacoes: body.observacoes,
                dataValidade: body.data_validade,
                itens: body.itens,
                anexos: Array.isArray(body.anexos) ? body.anexos : undefined,
            });

            if (!resultado.ok) {
                return NextResponse.json({ error: resultado.error }, { status: resultado.status });
            }

            return NextResponse.json({ success: true, data: resultado.proposta });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API propostas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
