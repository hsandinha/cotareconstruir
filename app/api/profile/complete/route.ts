import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function removeUndefined(obj: any): any {
    const result: any = {};
    for (const key in obj) {
        if (obj[key] !== undefined && obj[key] !== null) {
            result[key] = obj[key];
        }
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Verificar autenticação
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        const body = await request.json();
        const { type, data } = body; // type: 'cliente' | 'fornecedor'

        if (type === 'cliente') {
            // Verificar se email já está em uso
            const { data: existingClientes } = await supabaseAdmin
                .from('clientes')
                .select('id')
                .eq('email', data.email)
                .limit(1);

            if (existingClientes && existingClientes.length > 0) {
                // Vincular ao existente
                const clienteId = existingClientes[0].id;
                await supabaseAdmin
                    .from('users')
                    .update({
                        cliente_id: clienteId
                    })
                    .eq('id', user.id);

                await supabaseAdmin
                    .from('clientes')
                    .update({
                        user_id: user.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', clienteId);

                return NextResponse.json({ success: true, clienteId });
            }

            // Criar novo cliente
            console.log('[API] Dados recebidos do modal:', data);

            const cleanData = removeUndefined(data);
            console.log('[API] Dados limpos (sem undefined):', cleanData);

            // Determinar se é CPF ou CNPJ baseado nos dados
            const cpfCnpjValue = data.cpf || data.cnpj || null;

            // Mapear campos do modal para campos da tabela clientes
            const clienteData = {
                nome: data.nome,
                email: data.email,
                telefone: data.telefone || null,
                cpf_cnpj: cpfCnpjValue ? cpfCnpjValue.replace(/\D/g, '') : null,  // Coluna única para CPF ou CNPJ
                cep: data.cep ? data.cep.replace(/\D/g, '') : null,
                logradouro: data.endereco || null,  // Modal usa 'endereco', banco usa 'logradouro'
                numero: data.numero || null,
                complemento: data.complemento || null,
                bairro: data.bairro || null,
                cidade: data.cidade || null,
                estado: data.estado || null,
                razao_social: data.razaoSocial || data.razao_social || null,
                user_id: user.id,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log('[API] Dados do cliente para inserir:', clienteData);

            const { data: newCliente, error: insertError } = await supabaseAdmin
                .from('clientes')
                .insert(clienteData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            console.log('[API] Cliente criado com ID:', newCliente.id);
            console.log('[API] Atualizando user:', user.id, 'com cliente_id:', newCliente.id);

            // Atualizar usuário com o vínculo
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    cliente_id: newCliente.id
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('[API] ERRO ao atualizar user com cliente_id:', updateError);
                throw updateError;
            }

            console.log('[API] User atualizado com sucesso!');

            return NextResponse.json({ success: true, clienteId: newCliente.id });

        } else if (type === 'fornecedor') {
            // Verificar se email já está em uso
            const { data: existingFornecedores } = await supabaseAdmin
                .from('fornecedores')
                .select('id')
                .eq('email', data.email)
                .limit(1);

            if (existingFornecedores && existingFornecedores.length > 0) {
                // Vincular ao existente
                const fornecedorId = existingFornecedores[0].id;
                await supabaseAdmin
                    .from('users')
                    .update({
                        fornecedor_id: fornecedorId
                    })
                    .eq('id', user.id);

                await supabaseAdmin
                    .from('fornecedores')
                    .update({
                        user_id: user.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', fornecedorId);

                return NextResponse.json({ success: true, fornecedorId });
            }

            // Criar novo fornecedor
            const cleanData = removeUndefined(data);

            // Mapear campos do modal para campos da tabela fornecedores
            const fornecedorData = {
                razao_social: data.razaoSocial || data.razao_social || null,
                nome_fantasia: data.nomeFantasia || data.nome_fantasia || null,
                cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
                email: data.email || null,
                telefone: data.telefone || null,
                cep: data.cep ? data.cep.replace(/\D/g, '') : null,
                logradouro: data.endereco || data.logradouro || null,  // Modal usa 'endereco', banco usa 'logradouro'
                numero: data.numero || null,
                complemento: data.complemento || null,
                bairro: data.bairro || null,
                cidade: data.cidade || null,
                estado: data.estado || null,
                user_id: user.id,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: newFornecedor, error: insertError } = await supabaseAdmin
                .from('fornecedores')
                .insert(fornecedorData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            // Atualizar usuário com o vínculo
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    fornecedor_id: newFornecedor.id
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Erro ao atualizar user com fornecedor_id:', updateError);
                throw updateError;
            }

            console.log('Fornecedor criado e vinculado:', { userId: user.id, fornecedorId: newFornecedor.id });

            return NextResponse.json({ success: true, fornecedorId: newFornecedor.id });
        }

        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

    } catch (error: any) {
        console.error('Erro ao completar cadastro:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
