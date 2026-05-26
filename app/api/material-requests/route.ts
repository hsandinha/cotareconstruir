import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { findSimilarMateriais, pickProbableDuplicate } from '@/lib/materialSimilarity';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = req.cookies
            .getAll()
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;
        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                // ignore
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

/**
 * POST /api/material-requests
 * Body: {
 *   nome: string,
 *   unidade?: string,
 *   descricao?: string,
 *   grupo_sugerido?: string,
 *   tipo_solicitante?: 'cliente' | 'fornecedor',
 *   fornecedor_id?: string,
 *   contexto?: object
 * }
 * Verifica similaridade com materiais existentes. Se encontrar duplicata
 * provável retorna 409 com a sugestão. Caso contrário cria pré-cadastro
 * em `solicitacoes_materiais` aguardando aprovação do admin.
 */
export async function POST(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const body = await req.json();
        const nome: string = (body?.nome || '').toString().trim();
        const unidade: string = (body?.unidade || 'unid').toString().trim() || 'unid';
        const descricao: string | undefined = body?.descricao ? String(body.descricao).trim() : undefined;
        const grupo_sugerido: string | undefined = body?.grupo_sugerido ? String(body.grupo_sugerido).trim() : undefined;
        const fornecedor_id: string | null = body?.fornecedor_id || null;
        const contexto = body?.contexto && typeof body.contexto === 'object' ? body.contexto : {};

        let tipo_solicitante: 'cliente' | 'fornecedor' = body?.tipo_solicitante === 'cliente' ? 'cliente' : 'fornecedor';
        if (!fornecedor_id) tipo_solicitante = 'cliente';

        if (!nome) {
            return NextResponse.json({ error: 'Nome do material é obrigatório' }, { status: 400 });
        }

        // IA / similaridade: busca materiais já cadastrados parecidos.
        const similares = await findSimilarMateriais(supabaseAdmin, nome, { limit: 5, threshold: 0.3 });
        const provavel = pickProbableDuplicate(similares, 0.78);

        const force: boolean = Boolean(body?.force);

        if (provavel && !force) {
            return NextResponse.json({
                success: false,
                duplicate: true,
                suggestion: provavel,
                similares,
                message: `Encontramos um material parecido já cadastrado: "${provavel.nome}". Use-o ou confirme para enviar mesmo assim.`,
            }, { status: 409 });
        }

        // Evita criar solicitações pendentes duplicadas para o mesmo solicitante.
        const { data: existing } = await supabaseAdmin
            .from('solicitacoes_materiais')
            .select('id, status')
            .eq('status', 'pendente')
            .ilike('nome', nome)
            .eq(fornecedor_id ? 'fornecedor_id' : 'solicitante_user_id', fornecedor_id || user.id)
            .limit(1)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                success: true,
                data: existing,
                alreadyPending: true,
                message: 'Já existe uma solicitação pendente para este material.',
            });
        }

        const { data, error } = await supabaseAdmin
            .from('solicitacoes_materiais')
            .insert({
                fornecedor_id,
                solicitante_user_id: user.id,
                tipo_solicitante,
                nome,
                unidade,
                descricao,
                grupo_sugerido,
                similares,
                contexto,
                status: 'pendente',
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar solicitação de material:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data, similares });
    } catch (error: any) {
        console.error('Erro na API material-requests:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

/**
 * GET /api/material-requests
 * Lista as solicitações do próprio usuário (cliente ou fornecedor).
 */
export async function GET(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const fornecedor_id = searchParams.get('fornecedor_id');

        let query = supabaseAdmin
            .from('solicitacoes_materiais')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (fornecedor_id) {
            query = query.eq('fornecedor_id', fornecedor_id);
        } else {
            query = query.eq('solicitante_user_id', user.id);
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error('Erro na API material-requests GET:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
