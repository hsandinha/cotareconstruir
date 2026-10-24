/**
 * Por que o fornecedor X não recebeu a cotação Y?
 *
 * Repete, na ordem, os mesmos filtros que app/api/cotacoes/route.ts aplica ao
 * montar os convites, e diz em qual deles o fornecedor caiu fora:
 *
 *   1. status do fornecedor ∈ (active, pending)
 *   2. região de atendimento cobre a cidade da obra
 *   3. fornecedor pertence ao grupo de insumo da cotação
 *   4. se "apenas materiais ativos", tem ao menos 1 material ativo na cotação
 *
 * Uso:
 *   node scripts/diagnostico-convite.mjs 10093                 # quem foi convidado e por quê
 *   node scripts/diagnostico-convite.mjs 10093 "CASA DO CONSTRUTOR"
 *   node scripts/diagnostico-convite.mjs 10093 d68c1f5a-...    # por id
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
);

const numero = process.argv[2];
const alvo = process.argv[3];

if (!numero) {
    console.error('❌ Informe o número da cotação. Ex: node scripts/diagnostico-convite.mjs 10093');
    process.exit(1);
}

/** Mesma normalização de nome de grupo usada na rota. */
function normalizeGroupName(nome) {
    return String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();
}

function regioesDe(raw) {
    if (Array.isArray(raw)) return raw.map((r) => String(r || '').toLowerCase()).filter(Boolean);
    if (typeof raw === 'string') return raw.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
    return [];
}

async function main() {
    const { data: cotacao } = await db
        .from('cotacoes')
        .select('id, numero, status, obra_id, created_at')
        .eq('numero', numero)
        .maybeSingle();

    if (!cotacao) {
        console.error(`❌ Cotação #${numero} não encontrada`);
        process.exit(1);
    }

    const { data: obra } = await db
        .from('obras')
        .select('nome, cidade, bairro, estado')
        .eq('id', cotacao.obra_id)
        .maybeSingle();

    const { data: itens } = await db
        .from('cotacao_itens')
        .select('id, nome, material_id, grupo, quantidade, unidade')
        .eq('cotacao_id', cotacao.id);

    // `group_id` não é coluna de `cotacoes` — a rota o carrega só em memória
    // durante o disparo. Depois do fato, o caminho de volta é o nome do grupo
    // gravado em cotacao_itens.grupo.
    const { data: grupos } = await db.from('grupos_insumo').select('id, nome');
    const grupoPorNome = new Map((grupos || []).map((g) => [normalizeGroupName(g.nome), g]));
    const nomeGrupoItem = (itens || []).map((i) => i.grupo).find(Boolean);
    const grupo = nomeGrupoItem ? grupoPorNome.get(normalizeGroupName(nomeGrupoItem)) || null : null;
    const groupId = grupo?.id || null;

    const cityName = (obra?.cidade || '').toLowerCase();

    console.log(`\n═══ Cotação #${cotacao.numero} ═══`);
    console.log(`status      : ${cotacao.status}`);
    console.log(`obra        : ${obra?.nome || '—'} — ${obra?.cidade || '?'}/${obra?.estado || '?'}`);
    console.log(`grupo       : ${grupo?.nome || `(nome "${nomeGrupoItem}" não casa com grupos_insumo)`}  [${groupId || '—'}]`);
    console.log(`itens       : ${(itens || []).map((i) => i.nome).join(' | ')}`);

    const materialIds = (itens || []).map((i) => i.material_id).filter(Boolean);

    const { data: convites } = await db
        .from('cotacao_convites')
        .select('fornecedor_id')
        .eq('cotacao_id', cotacao.id);
    const convidados = new Set((convites || []).map((c) => c.fornecedor_id));
    console.log(`convidados  : ${convidados.size}`);

    // Universo que a rota considera
    const { data: fornecedores } = await db
        .from('fornecedores')
        .select('id, razao_social, nome_fantasia, status, regioes_atendimento, apenas_materiais_ativos, whatsapp, telefone, email');

    const { data: vinculos } = await db
        .from('fornecedor_grupo')
        .select('fornecedor_id, grupo_id');
    const gruposPorFornecedor = new Map();
    for (const v of vinculos || []) {
        const set = gruposPorFornecedor.get(v.fornecedor_id) || new Set();
        set.add(v.grupo_id);
        gruposPorFornecedor.set(v.fornecedor_id, set);
    }

    const { data: ativos } = materialIds.length
        ? await db.from('fornecedor_materiais').select('fornecedor_id, material_id').eq('ativo', true).in('material_id', materialIds)
        : { data: [] };
    const ativosPorFornecedor = new Map();
    for (const a of ativos || []) {
        const set = ativosPorFornecedor.get(a.fornecedor_id) || new Set();
        set.add(a.material_id);
        ativosPorFornecedor.set(a.fornecedor_id, set);
    }

    /** Devolve o primeiro filtro que barrou este fornecedor, ou null se passou. */
    function barreira(f) {
        if (!['active', 'pending'].includes(f.status)) return `status "${f.status}" (só active/pending entram)`;

        const regioes = regioesDe(f.regioes_atendimento);
        const inRegion = regioes.length === 0 || !cityName || regioes.some((r) => r.includes(cityName));
        if (!inRegion) return `região não cobre "${obra?.cidade}" (atende: ${regioes.join(', ') || '—'})`;

        const grupos = gruposPorFornecedor.get(f.id);
        if (!grupos || grupos.size === 0) return 'não tem NENHUM grupo de insumo vinculado';
        if (groupId && !grupos.has(groupId)) {
            return `não está no grupo "${grupo?.nome}" (tem ${grupos.size} outro(s) grupo(s))`;
        }

        if (f.apenas_materiais_ativos) {
            const set = ativosPorFornecedor.get(f.id);
            const temAtivo = materialIds.some((mid) => set?.has(mid));
            if (!temAtivo) return 'optou por "apenas materiais ativos" e nenhum item desta cotação está ativo na lista dele';
        }
        return null;
    }

    if (alvo) {
        const chave = String(alvo).toLowerCase();
        const f = (fornecedores || []).find((x) =>
            x.id === alvo
            || x.id?.startsWith(chave)
            || String(x.razao_social || '').toLowerCase().includes(chave)
            || String(x.nome_fantasia || '').toLowerCase().includes(chave));

        if (!f) {
            console.error(`\n❌ Fornecedor "${alvo}" não encontrado`);
            process.exit(1);
        }

        const motivo = barreira(f);
        console.log(`\n═══ ${f.razao_social} ${f.nome_fantasia ? `(${f.nome_fantasia})` : ''} ═══`);
        console.log(`id          : ${f.id}`);
        console.log(`status      : ${f.status}`);
        console.log(`regiões     : ${regioesDe(f.regioes_atendimento).join(', ') || '(vazio = atende todas)'}`);
        console.log(`grupos      : ${(gruposPorFornecedor.get(f.id) || new Set()).size}`);
        console.log(`apenas ativos: ${f.apenas_materiais_ativos ? 'SIM' : 'não'}`);
        console.log(`whatsapp    : ${f.whatsapp || f.telefone || '—'}`);
        console.log(`\nconvidado   : ${convidados.has(f.id) ? 'SIM' : 'NÃO'}`);
        console.log(motivo ? `motivo      : ❌ ${motivo}` : 'motivo      : ✅ passa em todos os filtros');
        return;
    }

    // Visão geral: quantos caem em cada filtro
    const contagem = new Map();
    for (const f of fornecedores || []) {
        const motivo = barreira(f) || '✅ elegível';
        const chave = motivo.replace(/"[^"]*"/g, '"…"').replace(/\(.*\)/, '').trim();
        contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    console.log(`\n═══ Funil sobre ${(fornecedores || []).length} fornecedores ═══`);
    for (const [motivo, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`${String(n).padStart(4)}  ${motivo}`);
    }
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
