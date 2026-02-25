/**
 * API Route: Admin - Gerenciar Fornecedores
 * CRUD de fornecedores (requer admin) - Bypass RLS com service_role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getFornecedorRecadastroEmailTemplate } from '@/lib/emailService';
import { getSupplierAccessOwnerUserId, syncLegacySupplierPointersForUser, upsertUserSupplierAccessLink } from '@/lib/supplierAccessServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isMalformedArrayLiteralError(error: any) {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('malformed array literal');
}

function splitTextList(value: string) {
    return value
        .split(/[,\n;]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function sanitizeFornecedorPayload(payload: Record<string, any>) {
    const next = { ...payload };

    if (typeof next.email === 'string') {
        next.email = next.email.trim();
    }

    // Evita erro em ambientes onde essas colunas podem estar como text[]
    for (const key of ['regioes_atendimento', 'grupo_insumos']) {
        if (typeof next[key] === 'string' && next[key].trim() === '') {
            next[key] = null;
        }
    }

    return next;
}

function convertFornecedorArrayishFieldsForRetry(payload: Record<string, any>) {
    const next = { ...payload };

    for (const key of ['regioes_atendimento', 'grupo_insumos']) {
        const value = next[key];
        if (typeof value === 'string') {
            const parsed = splitTextList(value);
            next[key] = parsed.length > 0 ? parsed : null;
        }
    }

    return next;
}

function normalizeEmail(value: unknown) {
    return String(value || '').trim().toLowerCase();
}

async function listLinkedFornecedorIdsForSupplierUser(supabase: any, fornecedorId: string) {
    let ownerUserId: string | null = null;

    try {
        const { data: accessRow, error } = await supabase
            .from('user_fornecedor_access')
            .select('user_id')
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle();
        if (!error && accessRow?.user_id) {
            ownerUserId = accessRow.user_id;
        }
    } catch {
        // Tabela pode não existir em ambientes legados
    }

    if (!ownerUserId) {
        const { data: fornecedorRow } = await supabase
            .from('fornecedores')
            .select('user_id')
            .eq('id', fornecedorId)
            .maybeSingle();
        ownerUserId = fornecedorRow?.user_id || null;
    }

    const ids = new Set<string>([fornecedorId]);

    if (!ownerUserId) {
        return { ownerUserId: null, linkedFornecedorIds: [...ids] };
    }

    try {
        const { data: links, error } = await supabase
            .from('user_fornecedor_access')
            .select('fornecedor_id')
            .eq('user_id', ownerUserId);
        if (!error) {
            (links || []).forEach((row: any) => {
                if (row?.fornecedor_id) ids.add(row.fornecedor_id);
            });
        }
    } catch {
        // ignore
    }

    // Fallback legado para ambientes sem vínculos N:N completos
    if (ids.size <= 1) {
        const { data: legacyRows } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('user_id', ownerUserId);
        (legacyRows || []).forEach((row: any) => {
            if (row?.id) ids.add(row.id);
        });
    }

    return { ownerUserId, linkedFornecedorIds: [...ids] };
}

// Verificar se é admin
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value          // cookie setado pelo login page
        || request.cookies.get('sb-access-token')?.value; // fallback legado

    if (!token) {
        return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return { user, supabase };
}

// GET - Listar fornecedores com dados relacionados
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const [fornecedoresRes, gruposRes, usersRes, fornecedorGruposRes] = await Promise.all([
            supabase.from('fornecedores').select('*'),
            supabase.from('grupos_insumo').select('*'),
            supabase.from('users').select('id, email, role, roles, fornecedor_id, must_change_password, last_login_at'),
            supabase.from('fornecedor_grupo').select('fornecedor_id, grupo_id')
        ]);

        let userFornecedorAccess: any[] = [];
        try {
            const { data, error } = await supabase
                .from('user_fornecedor_access')
                .select('user_id, fornecedor_id, is_primary');
            if (!error) {
                userFornecedorAccess = data || [];
            }
        } catch {
            // Tabela pode ainda não existir em ambientes sem migration aplicada
        }

        if (fornecedoresRes.error) throw fornecedoresRes.error;

        return NextResponse.json({
            fornecedores: fornecedoresRes.data || [],
            grupos: gruposRes.data || [],
            users: usersRes.data || [],
            fornecedorGrupos: fornecedorGruposRes.data || [],
            userFornecedorAccess,
        });
    } catch (error: any) {
        console.error('Erro ao carregar fornecedores:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// POST - Criar fornecedor ou operações especiais
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const { action } = body;

        if (action === 'create') {
            const { data: supabaseData } = body;
            const basePayload = sanitizeFornecedorPayload({
                ...supabaseData,
            });

            const codigo = `F${Date.now().toString().slice(-6)}`;
            const insertPayload = {
                ...basePayload,
                codigo: basePayload?.codigo || codigo,
                codigo_grupo: basePayload?.codigo_grupo ?? '',
                grupo_insumos: basePayload?.grupo_insumos ?? null,
                created_at: new Date().toISOString(),
            };

            let { data: newFornecedor, error } = await supabase
                .from('fornecedores')
                .insert(insertPayload)
                .select()
                .single();

            if (error && isMalformedArrayLiteralError(error)) {
                const retryPayload = convertFornecedorArrayishFieldsForRetry(insertPayload);
                const retry = await supabase
                    .from('fornecedores')
                    .insert(retryPayload)
                    .select()
                    .single();
                newFornecedor = retry.data;
                error = retry.error;
            }

            if (error) throw error;

            return NextResponse.json({ fornecedor: newFornecedor });
        }

        if (action === 'addGrupo') {
            const { fornecedor_id, grupo_id } = body;

            const { error } = await supabase
                .from('fornecedor_grupo')
                .insert({ fornecedor_id, grupo_id });

            if (error) throw error;

            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', fornecedor_id);

            return NextResponse.json({ success: true });
        }

        if (action === 'removeGrupo') {
            const { fornecedor_id, grupo_id } = body;

            const { error } = await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', fornecedor_id)
                .eq('grupo_id', grupo_id);

            if (error) throw error;

            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', fornecedor_id);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro no POST fornecedores:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// PUT - Atualizar fornecedor
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const {
            id,
            email_update_scope,
            ...updateData
        } = body as Record<string, any>;

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        const { data: currentFornecedor, error: currentFornecedorError } = await supabase
            .from('fornecedores')
            .select('id, email')
            .eq('id', id)
            .maybeSingle();

        if (currentFornecedorError) throw currentFornecedorError;
        if (!currentFornecedor) {
            return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
        }

        const sanitizedUpdateData = sanitizeFornecedorPayload(updateData);
        const emailUpdateScope = email_update_scope === 'all_linked' ? 'all_linked' : 'single';
        const requestedContactEmail = typeof sanitizedUpdateData.email === 'string'
            ? sanitizedUpdateData.email.trim()
            : null;
        const currentContactEmail = typeof currentFornecedor.email === 'string'
            ? currentFornecedor.email.trim()
            : '';
        const contactEmailChanged = Boolean(requestedContactEmail)
            && normalizeEmail(requestedContactEmail) !== normalizeEmail(currentContactEmail);

        let linkedFornecedorIdsForEmailPropagation: string[] = [id];
        let linkedOwnerUserId: string | null = null;
        let emailLoginSynced = false;
        let accessCredentialsResent = false;
        let warning: string | null = null;
        let loginSplitFromSharedAccount = false;
        let linkedExistingAccount = false;
        let createdNewAccount = false;

        if (contactEmailChanged && requestedContactEmail) {
            const linkedInfo = await listLinkedFornecedorIdsForSupplierUser(supabase, id);
            linkedFornecedorIdsForEmailPropagation = linkedInfo.linkedFornecedorIds.length > 0
                ? linkedInfo.linkedFornecedorIds
                : [id];
            linkedOwnerUserId = linkedInfo.ownerUserId;

            if (linkedOwnerUserId) {
                const { data: linkedUser, error: linkedUserError } = await supabase
                    .from('users')
                    .select('id, email, role, roles')
                    .eq('id', linkedOwnerUserId)
                    .maybeSingle();
                if (linkedUserError) throw linkedUserError;

                if (linkedUser) {
                    const isFornecedorUser = linkedUser.role === 'fornecedor' || linkedUser.roles?.includes?.('fornecedor');
                    if (!isFornecedorUser) {
                        return NextResponse.json(
                            { error: 'Conta vinculada não é um usuário de fornecedor. Ajuste em Gerenciar Usuários.' },
                            { status: 409 }
                        );
                    }

                    const loginEmailChanged = normalizeEmail(linkedUser.email) !== normalizeEmail(requestedContactEmail);
                    const hasMultipleLinkedFornecedores = linkedFornecedorIdsForEmailPropagation.filter(Boolean).length > 1;

                    if (loginEmailChanged && emailUpdateScope === 'single' && hasMultipleLinkedFornecedores) {
                        // Cenário de desmembramento: altera só esta empresa, removendo do login compartilhado
                        loginSplitFromSharedAccount = true;

                        const { data: existingTargetUser, error: existingTargetUserError } = await supabase
                            .from('users')
                            .select('id, email, role, roles, fornecedor_id')
                            .ilike('email', requestedContactEmail)
                            .maybeSingle();
                        if (existingTargetUserError) throw existingTargetUserError;

                        if (existingTargetUser) {
                            const targetIsFornecedor = existingTargetUser.role === 'fornecedor' || existingTargetUser.roles?.includes?.('fornecedor');
                            if (!targetIsFornecedor) {
                                return NextResponse.json(
                                    { error: 'O novo email pertence a uma conta que não é de fornecedor' },
                                    { status: 409 }
                                );
                            }
                        }

                        try {
                            const { error: removeLinkError } = await supabase
                                .from('user_fornecedor_access')
                                .delete()
                                .eq('user_id', linkedOwnerUserId)
                                .eq('fornecedor_id', id);
                            if (removeLinkError) throw removeLinkError;
                        } catch (removeError) {
                            console.error('Erro ao remover vínculo N:N do fornecedor no desmembramento:', removeError);
                            // fallback legado: segue adiante; sincronização abaixo limpa ponteiro legado
                        }

                        await syncLegacySupplierPointersForUser(supabase, linkedOwnerUserId);

                        if (existingTargetUser) {
                            const currentOwnerAfterUnlink = await getSupplierAccessOwnerUserId(supabase, id);
                            if (currentOwnerAfterUnlink && currentOwnerAfterUnlink !== existingTargetUser.id) {
                                return NextResponse.json(
                                    { error: 'Este fornecedor já está vinculado a outro usuário' },
                                    { status: 409 }
                                );
                            }

                            let shouldBePrimary = false;
                            try {
                                const { data: existingLinks } = await supabase
                                    .from('user_fornecedor_access')
                                    .select('id')
                                    .eq('user_id', existingTargetUser.id)
                                    .limit(1);
                                shouldBePrimary = !existingLinks || existingLinks.length === 0;
                            } catch {
                                shouldBePrimary = !existingTargetUser.fornecedor_id;
                            }

                            await upsertUserSupplierAccessLink(supabase, {
                                userId: existingTargetUser.id,
                                fornecedorId: id,
                                isPrimary: shouldBePrimary,
                                createdBy: auth.user.id,
                            });
                            await syncLegacySupplierPointersForUser(supabase, existingTargetUser.id);

                            linkedExistingAccount = true;
                        } else {
                            const defaultPassword = '123456';
                            const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
                                email: requestedContactEmail,
                                password: defaultPassword,
                                email_confirm: true,
                            });
                            if (authCreateError) {
                                throw authCreateError;
                            }

                            const newUserId = authData.user.id;
                            const { error: insertUserError } = await supabase
                                .from('users')
                                .insert({
                                    id: newUserId,
                                    email: requestedContactEmail,
                                    nome: sanitizedUpdateData.contato || sanitizedUpdateData.razao_social || '',
                                    role: 'fornecedor',
                                    roles: ['fornecedor'],
                                    fornecedor_id: id,
                                    status: 'pending',
                                    is_verified: false,
                                    must_change_password: true,
                                    password_changed_at: null,
                                    last_login_at: null,
                                });
                            if (insertUserError) throw insertUserError;

                            await upsertUserSupplierAccessLink(supabase, {
                                userId: newUserId,
                                fornecedorId: id,
                                isPrimary: true,
                                createdBy: auth.user.id,
                            });
                            await syncLegacySupplierPointersForUser(supabase, newUserId);

                            createdNewAccount = true;
                            emailLoginSynced = true;

                            try {
                                const template = getFornecedorRecadastroEmailTemplate({
                                    recipientEmail: requestedContactEmail,
                                    temporaryPassword: defaultPassword,
                                });
                                await sendEmail({
                                    to: requestedContactEmail,
                                    subject: template.subject,
                                    html: template.html,
                                    text: template.text,
                                });
                                accessCredentialsResent = true;
                            } catch (mailError) {
                                console.error('Erro ao enviar credenciais no desmembramento:', mailError);
                                warning = 'Cadastro atualizado e novo acesso criado, mas houve falha ao enviar as credenciais por email.';
                            }
                        }
                    } else if (loginEmailChanged) {
                        const { data: emailConflictUsers, error: emailConflictUsersError } = await supabase
                            .from('users')
                            .select('id')
                            .ilike('email', requestedContactEmail)
                            .neq('id', linkedOwnerUserId)
                            .limit(1);
                        if (emailConflictUsersError) throw emailConflictUsersError;

                        if (emailConflictUsers && emailConflictUsers.length > 0) {
                            return NextResponse.json(
                                { error: 'Este email já está em uso por outro usuário de acesso' },
                                { status: 409 }
                            );
                        }

                        const defaultPassword = '123456';
                        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(linkedOwnerUserId, {
                            email: requestedContactEmail,
                            email_confirm: true,
                            password: defaultPassword,
                        });

                        if (authUpdateError) {
                            const authMsg = String(authUpdateError.message || '');
                            if (
                                authMsg.toLowerCase().includes('already') ||
                                authMsg.toLowerCase().includes('registered') ||
                                authMsg.toLowerCase().includes('duplicate')
                            ) {
                                return NextResponse.json(
                                    { error: 'Este email já está em uso por outra conta de login' },
                                    { status: 409 }
                                );
                            }
                            throw authUpdateError;
                        }

                        const { error: userEmailSyncError } = await supabase
                            .from('users')
                            .update({
                                email: requestedContactEmail,
                                status: 'pending',
                                must_change_password: true,
                                password_changed_at: null,
                                updated_at: new Date().toISOString(),
                            } as any)
                            .eq('id', linkedOwnerUserId);
                        if (userEmailSyncError) throw userEmailSyncError;

                        emailLoginSynced = true;

                        try {
                            const template = getFornecedorRecadastroEmailTemplate({
                                recipientEmail: requestedContactEmail,
                                temporaryPassword: defaultPassword,
                            });
                            await sendEmail({
                                to: requestedContactEmail,
                                subject: template.subject,
                                html: template.html,
                                text: template.text,
                            });
                            accessCredentialsResent = true;
                        } catch (mailError) {
                            console.error('Erro ao enviar credenciais após troca de email do fornecedor:', mailError);
                            warning = 'Email de login atualizado, mas houve falha ao enviar as novas credenciais para o novo email.';
                        }
                    } else {
                        // Mantém consistência caso já estejam sincronizando apenas contato para o mesmo email
                        emailLoginSynced = false;
                    }
                }
            }
        }

        const effectiveEmailUpdateScope = emailLoginSynced && !loginSplitFromSharedAccount ? 'all_linked' : emailUpdateScope;
        let { data, error } = await supabase
            .from('fornecedores')
            .update({
                ...sanitizedUpdateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error && isMalformedArrayLiteralError(error)) {
            const retryData = convertFornecedorArrayishFieldsForRetry(sanitizedUpdateData);
            const retry = await supabase
                .from('fornecedores')
                .update({
                    ...retryData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) throw error;
        let contactEmailUpdatedAcrossLinkedSuppliers = false;
        let updatedLinkedSuppliersCount = 1;

        if (effectiveEmailUpdateScope === 'all_linked' && requestedContactEmail) {
            try {
                const otherFornecedorIds = linkedFornecedorIdsForEmailPropagation.filter((linkedId) => linkedId !== id);

                if (otherFornecedorIds.length > 0) {
                    const { error: bulkEmailError } = await supabase
                        .from('fornecedores')
                        .update({
                            email: requestedContactEmail,
                            updated_at: new Date().toISOString()
                        })
                        .in('id', otherFornecedorIds);

                    if (bulkEmailError) {
                        warning = warning || 'Fornecedor atualizado, mas falhou ao propagar o email de contato para outras empresas vinculadas.';
                    } else {
                        contactEmailUpdatedAcrossLinkedSuppliers = true;
                        updatedLinkedSuppliersCount = otherFornecedorIds.length + 1;
                    }
                }
            } catch (bulkError) {
                console.error('Erro ao propagar email de contato para fornecedores vinculados:', bulkError);
                warning = warning || 'Fornecedor atualizado, mas ocorreu erro ao propagar o email de contato para empresas vinculadas.';
            }
        }

        return NextResponse.json({
            fornecedor: data,
            emailLoginSynced,
            accessCredentialsResent,
            warning,
            contactEmailUpdatedAcrossLinkedSuppliers,
            updatedLinkedSuppliersCount,
            contactEmailUpdateScopeApplied: effectiveEmailUpdateScope,
            loginEmailUpdatedFromFornecedor: emailLoginSynced,
            loginSplitFromSharedAccount,
            linkedExistingAccount,
            createdNewAccount,
        });
    } catch (error: any) {
        console.error('Erro ao atualizar fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// DELETE - Excluir fornecedor
export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Remover grupos associados primeiro
        await supabase
            .from('fornecedor_grupo')
            .delete()
            .eq('fornecedor_id', id);

        const { error } = await supabase
            .from('fornecedores')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Erro ao excluir fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}
