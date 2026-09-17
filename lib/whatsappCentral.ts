/**
 * Central de WhatsApp — persistência das conversas
 *
 * O envio e o recebimento continuam em `whatsappService.ts` (Meta Cloud API).
 * Aqui mora o que dá memória ao canal: toda mensagem que sai e toda que chega
 * vira linha em `whatsapp_mensagens`, pendurada na conversa daquele número.
 *
 * Nada aqui pode derrubar um envio: se a gravação falhar, a mensagem já foi
 * para o cliente e o que importa é não estourar a rota. Por isso todo erro é
 * logado e engolido.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente criado sob demanda — e não no topo do módulo — para que importar
 * este arquivo num teste (ou num build sem env) não exploda.
 */
function db(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.warn('⚠️ WhatsApp Central: Supabase não configurado, mensagem não registrada');
        return null;
    }
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Janela da Meta: texto livre só até 24h depois da última mensagem do contato. */
export const JANELA_HORAS = 24;

// ============================================================
// TELEFONE
// ============================================================

/**
 * Normaliza para o formato da Meta: só dígitos, com DDI.
 * Mesma regra do envio — os dois lados precisam chegar na mesma chave,
 * senão a resposta do cliente abre uma conversa separada do disparo.
 */
export function normalizarTelefone(phone: string): string {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (!digits.startsWith('55') && digits.length <= 11) digits = '55' + digits;
    return digits;
}

/** (31) 99999-8888 a partir de 5531999998888 — para a tela, não para a API. */
export function formatarTelefone(telefone: string): string {
    const d = (telefone || '').replace(/\D/g, '');
    const semDdi = d.startsWith('55') ? d.slice(2) : d;
    if (semDdi.length === 11) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
    if (semDdi.length === 10) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
    return `+${d}`;
}

/** A janela de 24h ainda está aberta para este contato? */
export function janelaAberta(ultimaEntradaEm: string | null | undefined): boolean {
    if (!ultimaEntradaEm) return false;
    const limite = new Date(ultimaEntradaEm).getTime() + JANELA_HORAS * 3600 * 1000;
    return Date.now() < limite;
}

// ============================================================
// TEMPLATES — texto para a tela
// ============================================================

/**
 * Corpo dos templates aprovados, igual ao que foi submetido em
 * scripts/create-whatsapp-templates.mjs. Serve para a central mostrar o que
 * o cliente recebeu: guardar só "nova_cotacao_fornecedor + [1024, Obra X]"
 * não diz nada para quem está lendo a conversa.
 *
 * Template novo na Meta? Acrescente aqui também.
 */
const CORPO_TEMPLATES: Record<string, string> = {
    nova_cotacao_fornecedor:
        'Olá! Você recebeu uma nova cotação na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Obra:* {{2}}\n\nAcesse a plataforma para analisar os itens e enviar sua proposta.',
    nova_cotacao_fornecedor_v2:
        'Olá! Você recebeu uma nova cotação na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Obra:* {{2}}\n\nToque no botão abaixo para acessar a cotação e enviar sua proposta.',
    nova_mensagem_chat_fornecedor:
        'Olá! Um cliente iniciou uma conversa com você na Comprar e Construir.\n\n*Cliente:* {{1}}\n*Sobre:* {{2}}\n\nToque no botão abaixo para responder.',
    pedido_aprovado_fornecedor:
        'Boas notícias! Seu pedido foi aprovado na Comprar e Construir.\n\n*Pedido:* #{{1}}\n*Cliente:* {{2}}\n\nAcesse a plataforma para confirmar e preparar o envio.',
    pedido_aprovado_fornecedor_v2:
        'Boas notícias! Seu pedido foi aprovado na Comprar e Construir.\n\n*Pedido:* #{{1}}\n*Cliente:* {{2}}\n\nToque no botão abaixo para acessar o pedido e preparar o envio.',
    nova_proposta_cliente:
        'Você recebeu uma nova proposta na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Fornecedor:* {{2}}\n\nAcesse o mapa comparativo na plataforma para avaliar e decidir.',
    nova_proposta_cliente_v2:
        'Você recebeu uma nova proposta na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Fornecedor:* {{2}}\n\nToque no botão abaixo para ver a proposta no mapa comparativo.',
};

/** Templates que a central oferece quando a janela de 24h está fechada. */
export const TEMPLATES_DISPONIVEIS = Object.entries(CORPO_TEMPLATES).map(([nome, corpo]) => ({
    nome,
    corpo,
    variaveis: (corpo.match(/\{\{\d+\}\}/g) || []).length,
}));

/** Troca {{1}}, {{2}}... pelos valores reais. Template desconhecido vira um resumo. */
export function renderizarTemplate(nome: string, params: string[] = []): string {
    const corpo = CORPO_TEMPLATES[nome];
    if (!corpo) return `[template ${nome}]${params.length ? ` ${params.join(' · ')}` : ''}`;
    return corpo.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? `{{${i}}}`);
}

/** Extrai os parâmetros de corpo do formato que a Meta espera. */
export function paramsDoComponente(components?: any[]): string[] {
    const body = (components || []).find((c) => c?.type === 'body');
    return (body?.parameters || []).map((p: any) => String(p?.text ?? ''));
}

// ============================================================
// CONVERSAS
// ============================================================

/**
 * Devolve o id da conversa daquele número, criando se for a primeira vez.
 * Usa upsert por telefone para não duplicar quando duas mensagens chegam juntas.
 */
export async function garantirConversa(
    telefone: string,
    nomeContato?: string | null,
): Promise<string | null> {
    const supabase = db();
    if (!supabase) return null;

    const numero = normalizarTelefone(telefone);
    if (!numero) return null;

    try {
        const { data: existente } = await supabase
            .from('whatsapp_conversas')
            .select('id, nome_contato')
            .eq('telefone', numero)
            .maybeSingle();

        if (existente) {
            // O nome do perfil pode mudar ou só aparecer depois
            if (nomeContato && nomeContato !== existente.nome_contato) {
                await supabase
                    .from('whatsapp_conversas')
                    .update({ nome_contato: nomeContato, updated_at: new Date().toISOString() })
                    .eq('id', existente.id);
            }
            return existente.id;
        }

        const { data: nova, error } = await supabase
            .from('whatsapp_conversas')
            .insert({ telefone: numero, nome_contato: nomeContato || null })
            .select('id')
            .single();

        if (error) {
            // Corrida: outra requisição criou a conversa no meio do caminho
            const { data: recuperada } = await supabase
                .from('whatsapp_conversas')
                .select('id')
                .eq('telefone', numero)
                .maybeSingle();
            if (recuperada) return recuperada.id;
            console.error('❌ WhatsApp Central: erro ao criar conversa', error);
            return null;
        }

        // Descobre se o número é de fornecedor, cliente ou usuário cadastrado
        await supabase.rpc('whatsapp_vincular_contato', { p_conversa_id: nova.id });
        return nova.id;
    } catch (error) {
        console.error('❌ WhatsApp Central: falha ao garantir conversa', error);
        return null;
    }
}

// ============================================================
// REGISTRO DE MENSAGENS
// ============================================================

export interface RegistroEnvio {
    telefone: string;
    tipo?: string;
    texto?: string | null;
    templateNome?: string | null;
    templateParams?: string[] | null;
    waMessageId?: string | null;
    /** 'automatica' = disparo do sistema; 'central' = resposta feita na tela */
    origem?: 'automatica' | 'central';
    enviadaPor?: string | null;
    erro?: string | null;
}

/** Grava uma mensagem que a plataforma enviou (ou tentou enviar). */
export async function registrarEnvio(registro: RegistroEnvio): Promise<string | null> {
    const supabase = db();
    if (!supabase) return null;

    try {
        const conversaId = await garantirConversa(registro.telefone);
        if (!conversaId) return null;

        const texto = registro.templateNome
            ? renderizarTemplate(registro.templateNome, registro.templateParams || [])
            : registro.texto || null;

        const { data, error } = await supabase
            .from('whatsapp_mensagens')
            .insert({
                conversa_id: conversaId,
                wa_message_id: registro.waMessageId || null,
                direcao: 'saida',
                tipo: registro.templateNome ? 'template' : registro.tipo || 'text',
                texto,
                template_nome: registro.templateNome || null,
                template_params: registro.templateParams || null,
                status: registro.erro ? 'falhou' : 'enviada',
                erro: registro.erro ? { message: registro.erro } : null,
                origem: registro.origem || 'automatica',
                enviada_por: registro.enviadaPor || null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('❌ WhatsApp Central: erro ao registrar envio', error);
            return null;
        }
        return data.id;
    } catch (error) {
        console.error('❌ WhatsApp Central: falha ao registrar envio', error);
        return null;
    }
}

export interface RegistroRecebimento {
    telefone: string;
    nomeContato?: string | null;
    waMessageId: string;
    tipo: string;
    texto?: string | null;
    timestamp?: string | null;
    mediaId?: string | null;
    mediaMime?: string | null;
    mediaNome?: string | null;
    payload?: any;
}

/**
 * Grava uma mensagem recebida. Ignora repetida pelo wa_message_id: a Meta
 * reenvia o webhook quando não recebe 200 a tempo.
 */
export async function registrarRecebimento(registro: RegistroRecebimento): Promise<void> {
    const supabase = db();
    if (!supabase) return;

    try {
        const conversaId = await garantirConversa(registro.telefone, registro.nomeContato);
        if (!conversaId) return;

        const criadaEm = registro.timestamp
            ? new Date(Number(registro.timestamp) * 1000).toISOString()
            : new Date().toISOString();

        const { error } = await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conversaId,
            wa_message_id: registro.waMessageId,
            direcao: 'entrada',
            tipo: registro.tipo || 'text',
            texto: registro.texto || null,
            media_id: registro.mediaId || null,
            media_mime: registro.mediaMime || null,
            media_nome: registro.mediaNome || null,
            status: 'recebida',
            origem: 'recebida',
            payload: registro.payload || null,
            criada_em: criadaEm,
        });

        // 23505 = já existe essa wa_message_id; é reenvio da Meta, não é erro
        if (error && error.code !== '23505') {
            console.error('❌ WhatsApp Central: erro ao registrar recebimento', error);
        }
    } catch (error) {
        console.error('❌ WhatsApp Central: falha ao registrar recebimento', error);
    }
}

const STATUS_META: Record<string, string> = {
    sent: 'enviada',
    delivered: 'entregue',
    read: 'lida',
    failed: 'falhou',
};

/**
 * Atualiza o status de uma mensagem enviada (enviada → entregue → lida).
 * Status só anda para frente: a Meta às vezes entrega os eventos fora de ordem
 * e 'entregue' chegando depois de 'lida' não pode rebaixar a mensagem.
 */
export async function registrarStatus(
    waMessageId: string,
    statusMeta: string,
    erros?: any[],
): Promise<void> {
    const supabase = db();
    if (!supabase) return;

    const status = STATUS_META[statusMeta];
    if (!status) return;

    const ORDEM = ['pendente', 'enviada', 'entregue', 'lida'];

    try {
        const { data: atual } = await supabase
            .from('whatsapp_mensagens')
            .select('id, status')
            .eq('wa_message_id', waMessageId)
            .maybeSingle();

        if (!atual) return; // status de mensagem que não passou por aqui

        if (status !== 'falhou' && ORDEM.indexOf(status) <= ORDEM.indexOf(atual.status)) return;

        await supabase
            .from('whatsapp_mensagens')
            .update({ status, erro: erros?.length ? erros : null })
            .eq('id', atual.id);
    } catch (error) {
        console.error('❌ WhatsApp Central: falha ao registrar status', error);
    }
}

/** Zera o contador de não lidas — chamado quando o admin abre a conversa. */
export async function marcarConversaLida(conversaId: string): Promise<void> {
    const supabase = db();
    if (!supabase) return;
    await supabase
        .from('whatsapp_conversas')
        .update({ nao_lidas: 0, updated_at: new Date().toISOString() })
        .eq('id', conversaId);
}
