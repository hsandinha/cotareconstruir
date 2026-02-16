/**
 * API Route: Supplier Profile
 * GET  - Carrega perfil do fornecedor (users + fornecedores + grupos)
 * PUT  - Salva perfil do fornecedor (users + fornecedores)
 * POST - Salva grupos de insumo do fornecedor
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');

    // Tentar múltiplas fontes de token
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
        // Fallback para outros cookies
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token) {
        return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

// GET - Carregar perfil completo do fornecedor
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Buscar dados do usuário
        const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError || !userProfile) {
            return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
        }

        // 2. Buscar dados do fornecedor (se vinculado)
        let fornecedor = null;
        if (userProfile.fornecedor_id) {
            const { data } = await supabase
                .from('fornecedores')
                .select('*')
                .eq('id', userProfile.fornecedor_id)
                .single();
            fornecedor = data;
        }

        // 3. Buscar grupos do fornecedor
        let supplierGroups: string[] = [];
        if (userProfile.fornecedor_id) {
            const { data: gruposData } = await supabase
                .from('fornecedor_grupo')
                .select('grupo_id')
                .eq('fornecedor_id', userProfile.fornecedor_id);
            if (gruposData) {
                supplierGroups = gruposData.map(g => g.grupo_id);
            }
        }

        // 4. Buscar todos os grupos de insumo disponíveis
        const { data: allGroups } = await supabase
            .from('grupos_insumo')
            .select('id, nome')
            .order('nome');

        // 5. Buscar material_grupo e materiais para preview
        const allMG: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data: chunk } = await supabase
                .from('material_grupo')
                .select('material_id, grupo_id')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (!chunk || chunk.length === 0) break;
            allMG.push(...chunk);
            if (chunk.length < pageSize) break;
            page++;
        }

        const allMat: any[] = [];
        page = 0;
        while (true) {
            const { data: chunk } = await supabase
                .from('materiais')
                .select('id, nome, unidade')
                .order('nome')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (!chunk || chunk.length === 0) break;
            allMat.push(...chunk);
            if (chunk.length < pageSize) break;
            page++;
        }

        // Build materiaisByGrupo
        const matMap = new Map(allMat.map(m => [m.id, m]));
        const materiaisByGrupo: Record<string, Array<{ id: string; nome: string; unidade: string }>> = {};
        allMG.forEach(mg => {
            const mat = matMap.get(mg.material_id);
            if (mat) {
                if (!materiaisByGrupo[mg.grupo_id]) materiaisByGrupo[mg.grupo_id] = [];
                materiaisByGrupo[mg.grupo_id].push({ id: mat.id, nome: mat.nome, unidade: mat.unidade });
            }
        });

        return NextResponse.json({
            userProfile,
            fornecedor,
            supplierGroups,
            allGroups: allGroups || [],
            materiaisByGrupo,
        });

    } catch (error: any) {
        console.error('Erro ao carregar perfil fornecedor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Salvar perfil do fornecedor
export async function PUT(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { company, manager, preferences } = body;

        // 1. Atualizar tabela users
        const userUpdates: any = {
            company_name: company.razaoSocial,
            cnpj: company.cnpj?.replace(/\D/g, '') || null,
            state_registration: company.inscricaoEstadual || null,
            phone: company.telefone?.replace(/\D/g, '') || null,
            manager_name: manager.nome,
            manager_role: manager.cargo,
            email: manager.email,
            whatsapp: manager.whatsapp?.replace(/\D/g, '') || null,
            cep: company.cep?.replace(/\D/g, '') || null,
            endereco: company.logradouro,
            numero: company.numero,
            bairro: company.bairro,
            cidade: company.cidade,
            estado: company.estado,
            complemento: company.complemento,
            operating_regions: preferences.regioesAtendimento,
            operating_categories: preferences.categoriasMateriais,
            updated_at: new Date().toISOString()
        };

        await supabase
            .from('users')
            .update(userUpdates)
            .eq('id', user.id);

        // 2. Atualizar tabela fornecedores (se vinculado)
        const { data: userProfile } = await supabase
            .from('users')
            .select('fornecedor_id')
            .eq('id', user.id)
            .single();

        if (userProfile?.fornecedor_id) {
            const fornecedorUpdates: any = {
                razao_social: company.razaoSocial,
                cnpj: company.cnpj?.replace(/\D/g, '') || null,
                inscricao_estadual: company.inscricaoEstadual || null,
                telefone: company.telefone?.replace(/\D/g, '') || null,
                contato: manager.nome || null,
                email: manager.email || null,
                whatsapp: manager.whatsapp?.replace(/\D/g, '') || null,
                cep: company.cep?.replace(/\D/g, '') || null,
                logradouro: company.logradouro || null,
                numero: company.numero || null,
                complemento: company.complemento || null,
                bairro: company.bairro || null,
                cidade: company.cidade || null,
                estado: company.estado || null,
                updated_at: new Date().toISOString()
            };

            await supabase
                .from('fornecedores')
                .update(fornecedorUpdates)
                .eq('id', userProfile.fornecedor_id);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Erro ao salvar perfil fornecedor:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Salvar grupos de insumo
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { fornecedorId, groups } = body;

        if (!fornecedorId) {
            return NextResponse.json({ error: 'Fornecedor não identificado' }, { status: 400 });
        }

        // Verificar se o fornecedor pertence ao usuário
        const { data: userProfile } = await supabase
            .from('users')
            .select('fornecedor_id')
            .eq('id', user.id)
            .single();

        if (userProfile?.fornecedor_id !== fornecedorId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        // Remover grupos antigos
        await supabase.from('fornecedor_grupo').delete().eq('fornecedor_id', fornecedorId);

        // Inserir novos grupos
        if (groups && groups.length > 0) {
            const insertData = groups.map((grupoId: string) => ({
                fornecedor_id: fornecedorId,
                grupo_id: grupoId
            }));
            await supabase.from('fornecedor_grupo').insert(insertData);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Erro ao salvar grupos:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
