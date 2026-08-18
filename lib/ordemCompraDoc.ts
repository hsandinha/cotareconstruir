/**
 * Ordem de Compra imprimível.
 *
 * Monta o documento completo (faturamento, entrega, itens e condições comerciais)
 * em HTML e abre a caixa de impressão do navegador, onde o usuário salva em PDF
 * ou manda direto para a impressora. Usado pelo cliente (Mapa Comparativo /
 * Pedidos Confirmados) e pelo fornecedor (Minhas Vendas), para que os dois lados
 * enxerguem exatamente a mesma OC.
 */

export type OrdemCompraParte = {
    nome?: string | null;
    documento?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
};

export type OrdemCompraItem = {
    descricao?: string | null;
    quantidade?: number | null;
    unidade?: string | null;
    precoUnitario?: number | null;
    total?: number | null;
};

export type OrdemCompraDoc = {
    numero: string;
    emitidaEm?: string | null;
    statusLabel?: string | null;
    comprador: OrdemCompraParte;
    fornecedor: OrdemCompraParte;
    obra?: { nome?: string | null; endereco?: string | null; horarioEntrega?: string | null } | null;
    itens: OrdemCompraItem[];
    frete?: number | null;
    impostos?: number | null;
    total?: number | null;
    condicoes?: {
        pagamento?: string | null;
        prazoEntrega?: string | null;
        previsaoEntrega?: string | null;
        observacoes?: string | null;
    } | null;
};

const brl = (value: unknown) => {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

const dataBr = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
};

const dataHoraBr = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const esc = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const ou = (value: unknown, fallback = "—") => {
    const text = String(value ?? "").trim();
    return text ? esc(text) : fallback;
};

function parteHtml(titulo: string, parte: OrdemCompraParte) {
    return `
    <section class="parte">
        <h2>${esc(titulo)}</h2>
        <p class="nome">${ou(parte.nome)}</p>
        <dl>
            <div><dt>CPF/CNPJ</dt><dd>${ou(parte.documento)}</dd></div>
            <div><dt>E-mail</dt><dd>${ou(parte.email)}</dd></div>
            <div><dt>Telefone</dt><dd>${ou(parte.telefone)}</dd></div>
            <div class="wide"><dt>Endereço</dt><dd>${ou(parte.endereco)}</dd></div>
        </dl>
    </section>`;
}

export function buildOrdemCompraHtml(doc: OrdemCompraDoc): string {
    const itens = doc.itens || [];
    const subtotal = itens.reduce((sum, item) => {
        const total = Number(item.total);
        if (Number.isFinite(total)) return sum + total;
        return sum + Number(item.quantidade || 0) * Number(item.precoUnitario || 0);
    }, 0);

    const frete = Number(doc.frete) || 0;
    const impostos = Number(doc.impostos) || 0;
    const total = Number.isFinite(Number(doc.total)) && Number(doc.total) > 0
        ? Number(doc.total)
        : subtotal + frete + impostos;

    const linhas = itens.map((item, idx) => {
        const qtd = Number(item.quantidade) || 0;
        const unit = Number(item.precoUnitario) || 0;
        const linhaTotal = Number.isFinite(Number(item.total)) ? Number(item.total) : qtd * unit;
        return `
            <tr>
                <td class="num">${idx + 1}</td>
                <td>${ou(item.descricao)}</td>
                <td class="center">${qtd.toLocaleString("pt-BR")} ${ou(item.unidade, "")}</td>
                <td class="right">${brl(unit)}</td>
                <td class="right">${brl(linhaTotal)}</td>
            </tr>`;
    }).join("");

    const condicoes = doc.condicoes || {};

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ordem de Compra ${esc(doc.numero)}</title>
<style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #0f172a;
        font-size: 12px;
        line-height: 1.45;
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        border-bottom: 3px solid #0f172a;
        padding-bottom: 12px;
    }
    header h1 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
    header .marca { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .16em; color: #ea580c; }
    header .meta { text-align: right; font-size: 11px; color: #475569; }
    header .meta strong { display: block; font-size: 16px; color: #0f172a; }
    .partes { display: flex; gap: 16px; margin-top: 18px; }
    .parte { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .parte h2 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
    .parte .nome { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
    .parte dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .parte dl > div.wide { grid-column: 1 / -1; }
    .parte dt { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
    .parte dd { margin: 0; font-size: 11px; }
    .obra { margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .obra h2 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    thead th {
        background: #f1f5f9;
        border-bottom: 2px solid #cbd5e1;
        padding: 7px 8px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #475569;
        text-align: left;
    }
    tbody td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; vertical-align: top; }
    td.num { width: 26px; color: #94a3b8; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { padding: 6px 8px; font-variant-numeric: tabular-nums; }
    tfoot tr.total td { border-top: 2px solid #0f172a; font-size: 14px; font-weight: 700; padding-top: 9px; }
    .rodape { display: flex; gap: 16px; margin-top: 18px; }
    .rodape section { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .rodape h2 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; }
    .rodape dl { margin: 0; }
    .rodape dt { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-top: 6px; }
    .rodape dt:first-child { margin-top: 0; }
    .rodape dd { margin: 0; font-size: 11px; }
    .assinaturas { display: flex; gap: 48px; margin-top: 42px; }
    .assinaturas div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; color: #64748b; text-align: center; }
    .aviso { margin-top: 22px; font-size: 9px; color: #94a3b8; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
    <header>
        <div>
            <p class="marca">Comprar &amp; Construir</p>
            <h1>Ordem de Compra</h1>
        </div>
        <div class="meta">
            <strong>Nº ${esc(doc.numero)}</strong>
            Emitida em ${dataHoraBr(doc.emitidaEm)}
            ${doc.statusLabel ? `<br />Situação: ${esc(doc.statusLabel)}` : ""}
        </div>
    </header>

    <div class="partes">
        ${parteHtml("Comprador (faturamento)", doc.comprador)}
        ${parteHtml("Fornecedor", doc.fornecedor)}
    </div>

    ${doc.obra ? `
    <div class="obra">
        <h2>Entrega</h2>
        <p style="margin:0 0 4px;font-weight:600">${ou(doc.obra.nome, "Obra")}</p>
        <p style="margin:0">${ou(doc.obra.endereco)}</p>
        ${doc.obra.horarioEntrega ? `<p style="margin:4px 0 0;color:#475569">Horário de recebimento: ${esc(doc.obra.horarioEntrega)}</p>` : ""}
    </div>` : ""}

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Descrição</th>
                <th class="center">Qtd</th>
                <th class="right">Unitário</th>
                <th class="right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${linhas || `<tr><td colspan="5" class="center" style="padding:18px;color:#94a3b8">Sem itens</td></tr>`}
        </tbody>
        <tfoot>
            <tr><td colspan="4" class="right">Subtotal</td><td class="right">${brl(subtotal)}</td></tr>
            <tr><td colspan="4" class="right">Frete</td><td class="right">${brl(frete)}</td></tr>
            ${impostos > 0 ? `<tr><td colspan="4" class="right">Impostos</td><td class="right">${brl(impostos)}</td></tr>` : ""}
            <tr class="total"><td colspan="4" class="right">Total geral</td><td class="right">${brl(total)}</td></tr>
        </tfoot>
    </table>

    <div class="rodape">
        <section>
            <h2>Condições comerciais</h2>
            <dl>
                <dt>Forma de pagamento</dt><dd>${ou(condicoes.pagamento)}</dd>
                <dt>Prazo de entrega</dt><dd>${ou(condicoes.prazoEntrega)}</dd>
                <dt>Previsão de entrega</dt><dd>${ou(condicoes.previsaoEntrega)}</dd>
            </dl>
        </section>
        <section>
            <h2>Observações</h2>
            <p style="margin:0">${ou(condicoes.observacoes, "Sem observações.")}</p>
        </section>
    </div>

    <div class="assinaturas">
        <div>${ou(doc.comprador.nome, "Comprador")}</div>
        <div>${ou(doc.fornecedor.nome, "Fornecedor")}</div>
    </div>

    <p class="aviso">
        Documento gerado pela plataforma Comprar &amp; Construir (comprareconstruir.com).
        A transação comercial é de responsabilidade exclusiva entre comprador e fornecedor.
    </p>
</body>
</html>`;
}

/** Prazo de entrega em texto a partir do número de dias. */
export function formatPrazoEntrega(deliveryDays: number | null | undefined): string {
    if (deliveryDays === null || deliveryDays === undefined || !Number.isFinite(Number(deliveryDays))) return "—";
    const dias = Number(deliveryDays);
    if (dias === 0) return "Hoje";
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function formatDataEntrega(value?: string | null): string {
    return dataBr(value);
}

/**
 * Abre a Ordem de Compra na caixa de impressão do navegador ("Salvar como PDF").
 * Usa um iframe oculto para não esbarrar em bloqueador de pop-up.
 * Retorna false quando não há ambiente de navegador disponível.
 */
export function printOrdemCompra(doc: OrdemCompraDoc): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") return false;

    const html = buildOrdemCompraHtml(doc);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const cleanup = () => {
        // Espera o diálogo de impressão liberar o documento antes de remover
        window.setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
    };

    const frameWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument || frameWindow?.document;

    if (!frameWindow || !frameDoc) {
        cleanup();
        return false;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const doPrint = () => {
        try {
            frameWindow.focus();
            frameWindow.print();
        } catch (error) {
            console.error("Erro ao imprimir Ordem de Compra:", error);
        } finally {
            cleanup();
        }
    };

    // O onload cobre o carregamento normal; o timeout evita travar se ele não disparar
    let printed = false;
    const printOnce = () => {
        if (printed) return;
        printed = true;
        doPrint();
    };

    iframe.onload = printOnce;
    window.setTimeout(printOnce, 400);

    return true;
}
