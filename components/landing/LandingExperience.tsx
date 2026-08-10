"use client";

/**
 * LP "O Mapa na Mesa" — a página inteira é o produto sendo usado.
 * O scroll conta UMA cotação acontecendo: planilha → lista classificada →
 * WhatsApp dos fornecedores → concorrência anônima → mapa comparativo →
 * revelação por mérito → ordem de compra carimbada → entrega.
 *
 * Paleta: papel #FAF8F5 / concreto #F1EDE7 / tinta #1C1917 / laranja #F97316
 * (ação e mérito) / verde-planilha #15803D (economia) / grafite #292524.
 * Sem bibliotecas de animação: CSS 3D + IntersectionObserver + rAF.
 */

import Link from "next/link";
import { useInView, useScrollProgress, useTilt, useCountUp, usePrefersReducedMotion } from "./hooks";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, start: number, len: number) => clamp01((p - start) / len);
const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ */
/* Peças pequenas                                                      */
/* ------------------------------------------------------------------ */

function SectionLabel({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
    return (
        <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${dark ? "text-orange-400" : "text-[#C2410C]"}`}>
            {children}
        </p>
    );
}

function Tarja({ children, hachura = false }: { children: React.ReactNode; hachura?: boolean }) {
    return (
        <span className={`inline-block bg-[#1C1917] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FAF8F5] ${hachura ? "lp-tarja-hachura" : ""}`}>
            {children}
        </span>
    );
}

/** Fio condutor laranja: traço vertical que se desenha ao entrar na tela. */
function Thread() {
    const { ref, inView } = useInView<HTMLDivElement>(0.4);
    return (
        <div ref={ref} className="flex justify-center py-8" aria-hidden>
            <div
                className="w-0.5 rounded-full bg-[#F97316] transition-all duration-1000 ease-out"
                style={{ height: 72, transform: `scaleY(${inView ? 1 : 0})`, transformOrigin: "top" }}
            />
        </div>
    );
}

function Counter({ target, suffix = "", prefix = "", start }: { target: number; suffix?: string; prefix?: string; start: boolean }) {
    const value = useCountUp(target, start);
    return (
        <span className="font-mono tabular-nums">
            {prefix}
            {value.toLocaleString("pt-BR")}
            {suffix}
        </span>
    );
}

/* ------------------------------------------------------------------ */
/* Dados do mock (uma cotação realista)                                */
/* ------------------------------------------------------------------ */

const MAP_ITEMS = [
    { nome: "Cimento CP II-E-32 50kg", qtd: 120, un: "sc", precos: [33.9, 31.5, 34.8] },
    { nome: "Vergalhão CA-50 10mm 12m", qtd: 80, un: "br", precos: [42.0, 39.8, 41.2] },
    { nome: "Areia média lavada", qtd: 20, un: "m³", precos: [122.0, 112.0, 119.0] },
    { nome: "Bloco cerâmico 9×19×39", qtd: 3000, un: "un", precos: [2.95, 2.78, 2.9] },
    { nome: "Argamassa AC-II 20kg", qtd: 60, un: "sc", precos: [21.4, 19.9, 22.3] },
    { nome: "Tubo PVC solda 50mm 6m", qtd: 40, un: "br", precos: [45.6, 43.2, 44.1] },
] as const;

const FRETES = [350, 280, 0] as const;
const WINNER_COL = 1; // Fornecedor B: cobre todos os itens com o melhor total
const WINNER_NAME = "CONSTRUMAT MATERIAIS LTDA";

const colSubtotal = (col: number) => MAP_ITEMS.reduce((s, item) => s + item.qtd * item.precos[col], 0);
const colTotal = (col: number) => colSubtotal(col) + FRETES[col];
const DELTA_PROPOSTAS = Math.max(...[0, 1, 2].map(colTotal)) - Math.min(...[0, 1, 2].map(colTotal));

/* ------------------------------------------------------------------ */
/* 1. Hero — a cotação que se faz sozinha                              */
/* ------------------------------------------------------------------ */

function Hero() {
    const tilt = useTilt(4);
    const reduced = usePrefersReducedMotion();
    const { ref, inView } = useInView<HTMLDivElement>(0.1);

    return (
        <section id="hero" ref={ref} className="lp-paper-grain relative overflow-hidden bg-[#FAF8F5] px-6 pb-20 pt-32 md:pt-40">
            <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
                <div className={`transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
                    <SectionLabel>Suprimentos da construção, automatizados</SectionLabel>
                    <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-tight text-[#1C1917] md:text-6xl">
                        Cotar obra ainda é trabalho braçal.{" "}
                        <span className="relative inline-block">
                            <span className="relative z-10">Era.</span>
                            <span className="absolute inset-x-0 bottom-1 z-0 h-[45%] bg-[#F97316]/40" aria-hidden />
                        </span>
                    </h1>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#44403C]">
                        O Cotar e Construir pega sua lista de materiais, cota com fornecedores da região e devolve o
                        mapa comparativo pronto — no mesmo formato que suprimentos usa há 30 anos. Você compara, clica,
                        e a ordem de compra sai formal, com aceite e data. Economia de até{" "}
                        <span className="font-mono font-bold text-[#15803D]">31%</span>, demonstrada linha a linha.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <Link
                            href="/login"
                            className="rounded-lg bg-[#F97316] px-7 py-3.5 text-base font-bold text-white shadow-[4px_4px_0_#1C1917] transition-transform hover:-translate-y-0.5 hover:bg-[#C2410C]"
                        >
                            Montar minha lista
                        </Link>
                        <Link
                            href="/login"
                            className="rounded-lg border border-[#D6D3D1] px-7 py-3.5 text-base font-semibold text-[#44403C] transition-colors hover:border-[#F97316] hover:text-[#C2410C]"
                        >
                            Sou fornecedor
                        </Link>
                    </div>
                    <p className="mt-6 font-mono text-xs uppercase tracking-widest text-[#A8A29E]">
                        ↓ role e assista uma cotação acontecer
                    </p>
                </div>

                {/* Mock do mapa comparativo com tilt 3D */}
                <div style={{ perspective: 1200 }}>
                    <div
                        onMouseMove={reduced ? undefined : tilt.onMouseMove}
                        onMouseLeave={reduced ? undefined : tilt.onMouseLeave}
                        style={{ transform: reduced ? undefined : tilt.transform, transformStyle: "preserve-3d" }}
                        className="rounded-md border border-[#D6D3D1] bg-white p-5 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.35)] transition-transform duration-150"
                    >
                        <div className="flex items-baseline justify-between border-b-2 border-[#1C1917] pb-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#1C1917]">
                                Mapa Comparativo · Nº 0347
                            </p>
                            <p className="font-mono text-[10px] uppercase text-[#A8A29E]">3 propostas</p>
                        </div>
                        <table className="mt-3 w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-[#D6D3D1] font-mono text-[10px] uppercase tracking-wider text-[#78716C]">
                                    <th className="py-1.5 pr-2 font-semibold">Item</th>
                                    <th className="px-2 py-1.5 text-center font-semibold">
                                        <Tarja>Fornecedor A</Tarja>
                                    </th>
                                    <th className="bg-[#F97316]/[0.08] px-2 py-1.5 text-center font-semibold">
                                        <span className="block text-[9px] font-bold text-[#C2410C]">🏆 melhor preço total</span>
                                        <span className="text-[10px] font-bold text-[#1C1917]">{WINNER_NAME}</span>
                                    </th>
                                    <th className="px-2 py-1.5 text-center font-semibold">
                                        <Tarja>Fornecedor C</Tarja>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-xs tabular-nums text-[#44403C]">
                                {MAP_ITEMS.slice(0, 4).map((item) => (
                                    <tr key={item.nome} className="border-b border-[#EDE9E3]">
                                        <td className="max-w-[160px] truncate py-1.5 pr-2 font-sans text-[11px]">{item.nome}</td>
                                        <td className="px-2 py-1.5 text-center">{brl(item.precos[0])}</td>
                                        <td className="bg-[#F97316]/[0.08] px-2 py-1.5 text-center font-bold text-[#1C1917]">
                                            {brl(item.precos[1])}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">{brl(item.precos[2])}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold text-[#1C1917]">
                                    <td className="py-2 pr-2 font-sans text-[11px] uppercase tracking-wide">Total + frete</td>
                                    <td className="px-2 py-2 text-center">{brl(colTotal(0))}</td>
                                    <td className="border-2 border-[#F97316] bg-[#F97316]/[0.08] px-2 py-2 text-center">
                                        {brl(colTotal(1))}
                                    </td>
                                    <td className="px-2 py-2 text-center">{brl(colTotal(2))}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="mt-2 text-right font-mono text-[11px] font-bold text-[#15803D]">
                            diferença entre propostas: R$ {brl(DELTA_PROPOSTAS)}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 2. A dor — a segunda-feira do comprador                             */
/* ------------------------------------------------------------------ */

function Dor() {
    const { ref, inView } = useInView<HTMLDivElement>(0.25);
    const enter = (delay: number, rotate: number) =>
        `${inView ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"} transition-all duration-700` +
        ` [transition-delay:${delay}ms]`;

    return (
        <section className="bg-[#F1EDE7] px-6 py-24">
            <div ref={ref} className="mx-auto max-w-6xl">
                <SectionLabel>O jeito antigo</SectionLabel>
                <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#1C1917] md:text-5xl">
                    Dez ligações, três &ldquo;te respondo amanhã&rdquo; e uma planilha que ninguém confere.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44403C]">
                    Cotar do jeito antigo é caçar fornecedor no telefone, montar comparativo na mão e torcer para não
                    ter erro de unidade. No fim, ninguém compara nada de verdade — compara-se o que deu tempo. É aí que
                    a economia vai embora sem fazer barulho.
                </p>

                {/* Bancada vista de cima */}
                <div className="relative mt-14 grid gap-6 md:grid-cols-3">
                    <div className={enter(0, -2)} style={{ transform: inView ? "rotate(-2deg)" : "rotate(-6deg) translateY(40px)" }}>
                        <div className="rounded-sm border border-[#D6D3D1] bg-white p-4 shadow-[6px_6px_0_rgba(28,25,23,0.12)]">
                            <p className="border-b border-[#D6D3D1] pb-1 font-mono text-[10px] uppercase tracking-widest text-[#78716C]">
                                cotacao_obra_FINAL_v3(2).xlsx
                            </p>
                            <div className="mt-2 space-y-1 font-mono text-xs text-[#44403C]">
                                <p>cimento cp2 …… 33,9??</p>
                                <p className="text-red-600">#REF!</p>
                                <p>
                                    areia 20 <span className="line-through decoration-[#F97316] decoration-2">ton</span> m³
                                </p>
                                <p>frete ………… &ldquo;a combinar&rdquo;</p>
                                <p className="line-through decoration-[#F97316] decoration-2">vergalhao 38,00</p>
                            </div>
                        </div>
                    </div>
                    <div className={enter(150, 3)} style={{ transform: inView ? "rotate(2deg)" : "rotate(7deg) translateY(40px)" }}>
                        <div className="rounded-sm bg-[#FEF3C7] p-5 shadow-[6px_6px_0_rgba(28,25,23,0.12)]">
                            <p className="font-mono text-sm font-bold uppercase text-[#92400E]">Ligar de novo p/ depósito ☎️</p>
                            <p className="mt-2 font-mono text-xs text-[#92400E]">frete?? condições?? — perguntar CNPJ</p>
                            <p className="mt-4 text-right font-mono text-[10px] text-[#B45309]">seg, 7h40</p>
                        </div>
                    </div>
                    <div className={enter(300, -1)} style={{ transform: inView ? "rotate(-1deg)" : "rotate(-5deg) translateY(40px)" }}>
                        <div className="rounded-2xl border border-[#D6D3D1] bg-[#1C1917] p-4 text-white shadow-[6px_6px_0_rgba(28,25,23,0.12)]">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#A8A29E]">chamadas</p>
                            <div className="mt-2 space-y-1.5 text-sm">
                                <p className="flex justify-between"><span>Depósito do João</span><span className="font-mono text-red-400">7 perdidas</span></p>
                                <p className="flex justify-between"><span>Areial BH</span><span className="font-mono text-[#A8A29E]">ocupado</span></p>
                                <p className="flex justify-between"><span>Ferragens Sul</span><span className="font-mono text-[#A8A29E]">&ldquo;amanhã&rdquo;</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 3. Passo 1 — sua planilha já serve (cena sticky de 200vh)           */
/* ------------------------------------------------------------------ */

const XLSX_ROWS = [
    { cru: "CIM CP2 50kg", limpo: "Cimento CP II-E-32 50kg", grupo: "AGLOMERANTES" },
    { cru: "areia media 20m3", limpo: "Areia média lavada — 20 m³", grupo: "AGREGADOS" },
    { cru: "bloco ceramico 9x19", limpo: "Bloco cerâmico 9×19×39", grupo: "ALVENARIA" },
    { cru: "tubo pvc 50", limpo: "Tubo PVC solda 50mm 6m", grupo: "HIDRÁULICA" },
    { cru: "vergalhao 10", limpo: "Vergalhão CA-50 10mm 12m", grupo: "AÇOS" },
] as const;

function Lista() {
    const { ref, progress } = useScrollProgress<HTMLDivElement>();
    const reduced = usePrefersReducedMotion();
    const p = reduced ? 1 : progress;

    return (
        <section id="solucao" ref={ref} className="relative bg-[#FAF8F5]" style={{ height: "220vh" }}>
            <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden px-6 py-24">
                <div className="mx-auto w-full max-w-6xl">
                    <SectionLabel>Passo 1 · a lista</SectionLabel>
                    <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#1C1917] md:text-5xl">
                        Chegue com a planilha que você já usa. A gente entende ela.
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44403C]">
                        Importe seu Excel do jeito que ele está — o sistema identifica o grupo de cada material
                        automaticamente. Ou monte a lista no catálogo com mais de{" "}
                        <span className="font-mono font-bold text-[#1C1917]">19.000 materiais</span>, navegando pelas
                        fases da obra: da fundação ao acabamento, sem redigitar nada.
                    </p>

                    <div className="mt-12 grid gap-6 md:grid-cols-2">
                        {/* Excel cru */}
                        <div className="rounded-sm border border-[#D6D3D1] bg-white p-4 shadow-sm">
                            <p className="border-b border-[#D6D3D1] pb-2 font-mono text-[10px] uppercase tracking-widest text-[#78716C]">
                                minha_lista.xlsx — como chegou
                            </p>
                            <div className="mt-3 space-y-2">
                                {XLSX_ROWS.map((row, i) => {
                                    const rp = seg(p, 0.12 + i * 0.14, 0.12);
                                    return (
                                        <p
                                            key={row.cru}
                                            className="font-mono text-sm text-[#44403C] transition-all duration-300"
                                            style={{ opacity: 1 - rp * 0.65, textDecoration: rp > 0.9 ? "line-through" : "none" }}
                                        >
                                            {row.cru}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Lista classificada */}
                        <div className="rounded-sm border border-[#D6D3D1] bg-white p-4 shadow-[0_16px_40px_-20px_rgba(28,25,23,0.3)]">
                            <p className="border-b border-[#D6D3D1] pb-2 font-mono text-[10px] uppercase tracking-widest text-[#C2410C]">
                                sua lista no Cotar e Construir
                            </p>
                            <div className="mt-3 space-y-2">
                                {XLSX_ROWS.map((row, i) => {
                                    const rp = seg(p, 0.12 + i * 0.14, 0.12);
                                    return (
                                        <div
                                            key={row.limpo}
                                            className="flex items-center justify-between gap-2 transition-all duration-300"
                                            style={{ opacity: rp, transform: `translateX(${(1 - rp) * 24}px)` }}
                                        >
                                            <p className="text-sm font-medium text-[#1C1917]">{row.limpo}</p>
                                            <span
                                                className="shrink-0 rounded-sm border border-[#F97316] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#C2410C] transition-transform duration-200"
                                                style={{ transform: `scale(${rp > 0.85 ? 1 : 1.4})`, opacity: rp > 0.7 ? 1 : 0 }}
                                            >
                                                {row.grupo}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Letreiro do catálogo */}
                    <div className="mt-10 overflow-hidden border-y border-[#D6D3D1] py-2" aria-hidden>
                        <div className="lp-marquee flex w-max gap-8 font-mono text-xs uppercase tracking-wider text-[#A8A29E]">
                            {[0, 1].map((half) => (
                                <span key={half} className="flex gap-8">
                                    <span>vergalhão CA-50 10mm</span><span>·</span><span>CP II 50kg</span><span>·</span>
                                    <span>areia média m³</span><span>·</span><span>bloco 9×19×39</span><span>·</span>
                                    <span>argamassa AC-II</span><span>·</span><span>tubo PVC solda 50mm</span><span>·</span>
                                    <span>brita 1</span><span>·</span><span>telha cerâmica</span><span>·</span>
                                    <span>+ 19.000 materiais catalogados</span><span>·</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 4. Passo 2 — a cotação viaja de madrugada                           */
/* ------------------------------------------------------------------ */

const TIMELINE = [
    { hora: "22h04", texto: "lista fechada pelo cliente" },
    { hora: "22h05", texto: "8 fornecedores da região notificados no WhatsApp" },
    { hora: "07h12", texto: "primeira proposta recebida" },
    { hora: "09h30", texto: "mapa comparativo com 3 propostas" },
] as const;

function Madrugada() {
    const { ref, inView } = useInView<HTMLDivElement>(0.25);

    return (
        <section className="bg-[#F1EDE7] px-6 py-24">
            <div ref={ref} className="mx-auto max-w-6xl">
                <SectionLabel>Passo 2 · o disparo</SectionLabel>
                <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#1C1917] md:text-5xl">
                    Enquanto você dorme, sua cotação bate na porta dos fornecedores da região.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44403C]">
                    O disparo é automático, por grupo de insumo, direto no WhatsApp de quem vende — um toque na mensagem
                    e ele está dentro da cotação. Ele responde preço, frete, condição de pagamento livre
                    (&ldquo;28/56 dias&rdquo;), anexa ficha técnica. Agregado ele cota por tonelada; a conversão para m³
                    a plataforma faz.
                </p>

                <div className="mt-14 grid items-start gap-10 md:grid-cols-2">
                    {/* Linha do tempo */}
                    <ol className="relative space-y-8 border-l-2 border-[#F97316]/60 pl-6">
                        {TIMELINE.map((t, i) => (
                            <li
                                key={t.hora}
                                className="transition-all duration-700"
                                style={{ transitionDelay: `${i * 180}ms`, opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(16px)" }}
                            >
                                <span className="absolute -left-[7px] mt-1.5 block h-3 w-3 rounded-full border-2 border-[#F97316] bg-[#F1EDE7]" aria-hidden />
                                <p className="font-mono text-sm font-bold text-[#C2410C]">{t.hora}</p>
                                <p className="text-[#44403C]">{t.texto}</p>
                            </li>
                        ))}
                    </ol>

                    {/* Mock de WhatsApp */}
                    <div
                        className="rounded-2xl bg-[#E7E0D8] p-4 shadow-[0_16px_40px_-20px_rgba(28,25,23,0.35)] transition-all duration-700"
                        style={{ transitionDelay: "250ms", opacity: inView ? 1 : 0, transform: inView ? "scale(1)" : "scale(0.94)" }}
                    >
                        <div className="mb-3 flex items-center gap-2 border-b border-[#D6D3D1] pb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] font-bold text-white">C</span>
                            <div>
                                <p className="text-sm font-bold text-[#1C1917]">Cotar e Construir</p>
                                <p className="font-mono text-[10px] text-[#78716C]">mensagem automática · 22h05</p>
                            </div>
                            {inView && <span className="lp-pulse-badge ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-[10px] font-bold text-white">1</span>}
                        </div>
                        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-3 text-sm text-[#1C1917] shadow-sm">
                            <p className="font-semibold">Você recebeu uma solicitação de cotação 📋</p>
                            <p className="mt-1 text-[#44403C]">
                                Grupo: <span className="font-mono font-semibold">Agregados</span> · 4 itens · Região: sua praça
                            </p>
                            <button className="mt-3 w-full rounded-md bg-[#25D366] py-2 text-sm font-bold text-white" type="button" tabIndex={-1}>
                                Responder cotação
                            </button>
                        </div>
                        <div className="mt-3 ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#DCF8C6] p-3 text-sm text-[#1C1917] shadow-sm">
                            <p>
                                Areia média: <span className="font-mono font-bold">R$ 85,00/ton</span> · densidade 1,40
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-[#78716C]">
                                → convertido pela plataforma: R$ 119,00/m³
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 5. A regra da casa — concorrência sem constrangimento               */
/* ------------------------------------------------------------------ */

function Etica() {
    const { ref, inView } = useInView<HTMLDivElement>(0.35);
    const totais = [0, 1, 2].map(colTotal);

    return (
        <section id="etica" className="bg-[#292524] px-6 py-28 text-[#FAF8F5]">
            <div ref={ref} className="mx-auto max-w-6xl">
                <SectionLabel dark>A regra da casa</SectionLabel>
                <h2 className="mt-3 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                    Aqui ninguém sabe contra quem está cotando. E é por isso que todo mundo cota o seu melhor.
                </h2>
                <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#D6D3D1]">
                    Fomento à concorrência sem ferir a ética entre parceiros fornecedores: os preços chegam anônimos,
                    sem assédio comercial nem leilão predatório. Só o fornecedor que cota todos os itens com o melhor
                    preço total tem o nome revelado no mapa —{" "}
                    <span className="bg-[#F97316]/30 px-1 font-semibold text-white">revelação por mérito</span>. No
                    fechamento, cliente e fornecedor se apresentam de verdade.
                </p>

                <div className="mt-14 grid gap-6 md:grid-cols-3">
                    {["Fornecedor A", WINNER_NAME, "Fornecedor C"].map((nome, i) => {
                        const winner = i === WINNER_COL;
                        return (
                            <div key={nome} style={{ perspective: 900 }}>
                                <div
                                    className="relative h-44 transition-transform duration-700 [transform-style:preserve-3d]"
                                    style={{ transform: winner && inView ? "rotateY(180deg)" : winner ? "rotateY(0deg)" : inView ? "translateZ(-16px) scale(0.97)" : "none", transitionDelay: winner ? "400ms" : "0ms" }}
                                >
                                    {/* Frente: anônimo */}
                                    <div className="absolute inset-0 flex flex-col justify-between rounded-md border border-white/15 bg-[#1C1917] p-5 [backface-visibility:hidden]">
                                        <Tarja hachura>{winner ? "Fornecedor B" : nome}</Tarja>
                                        <div>
                                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#A8A29E]">total + frete</p>
                                            <p className="font-mono text-2xl font-bold tabular-nums">R$ {brl(totais[i])}</p>
                                        </div>
                                    </div>
                                    {/* Verso: revelado por mérito */}
                                    {winner && (
                                        <div className="absolute inset-0 flex flex-col justify-between rounded-md border-2 border-[#F97316] bg-[#1C1917] p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold uppercase leading-tight">{nome}</p>
                                                <span className="flex h-14 w-14 shrink-0 rotate-[-8deg] items-center justify-center rounded-full border-2 border-[#F97316] text-center font-mono text-[7px] font-bold uppercase leading-tight text-[#F97316]">
                                                    melhor preço · todos os itens
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-mono text-[10px] uppercase tracking-widest text-[#F97316]">revelado por mérito</p>
                                                <p className="font-mono text-2xl font-bold tabular-nums">R$ {brl(totais[i])}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-8 font-mono text-sm text-[#A8A29E]">
                    Os outros dois seguem anônimos. Sem constrangimento, sem retaliação.
                </p>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 6. Cena central — o mapa se monta na sua frente (sticky 300vh)      */
/* ------------------------------------------------------------------ */

function MapaCentral() {
    const { ref, progress } = useScrollProgress<HTMLDivElement>();
    const reduced = usePrefersReducedMotion();
    const p = reduced ? 1 : progress;

    const rise = seg(p, 0, 0.22); // grade levanta
    const reveal = seg(p, 0.78, 0.16); // tarja abre
    const deltaP = seg(p, 0.92, 0.08); // linha verde

    return (
        <section id="metodologia" ref={ref} className="relative bg-[#FAF8F5]" style={{ height: "320vh" }}>
            <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden px-6 py-20">
                <div className="mx-auto w-full max-w-6xl">
                    <SectionLabel>A cena central</SectionLabel>
                    <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#1C1917] md:text-5xl">
                        O mesmo mapa de preços de 30 anos de suprimentos. Preenchido em minutos, não em semanas.
                    </h2>

                    <div style={{ perspective: 1400 }} className="mt-10">
                        <div
                            className="rounded-md border border-[#D6D3D1] bg-white p-5 shadow-[0_32px_80px_-32px_rgba(28,25,23,0.4)] md:p-7"
                            style={{ transform: `rotateX(${(1 - rise) * 18}deg)`, opacity: 0.3 + rise * 0.7, transformOrigin: "center bottom" }}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#1C1917] pb-2">
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#1C1917]">
                                    Mapa Comparativo Nº 0347 · Obra Residencial Vila Nova
                                </p>
                                <p className="font-mono text-[10px] uppercase text-[#A8A29E]">itens nas linhas · fornecedores nas colunas</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="mt-3 w-full min-w-[640px] border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#D6D3D1] font-mono text-[10px] uppercase tracking-wider text-[#78716C]">
                                            <th className="py-2 pr-3 text-left font-semibold">Item</th>
                                            <th className="px-2 py-2 text-center font-semibold">Qtd</th>
                                            {[0, 1, 2].map((col) => (
                                                <th key={col} className={`px-3 py-2 text-center font-semibold ${col === WINNER_COL && reveal > 0 ? "bg-[#F97316]/[0.08]" : ""}`}>
                                                    {col === WINNER_COL ? (
                                                        <span className="relative inline-block">
                                                            <Tarja hachura>Fornecedor B</Tarja>
                                                            <span
                                                                className="absolute inset-0 flex items-center justify-center overflow-hidden whitespace-nowrap bg-[#F97316] px-1 font-mono text-[10px] font-bold uppercase text-white"
                                                                style={{ clipPath: `inset(0 ${100 - reveal * 100}% 0 0)` }}
                                                            >
                                                                {WINNER_NAME}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <Tarja>{col === 0 ? "Fornecedor A" : "Fornecedor C"}</Tarja>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-sm tabular-nums text-[#44403C]">
                                        {MAP_ITEMS.map((item, rowIdx) => (
                                            <tr key={item.nome} className="border-b border-[#EDE9E3]">
                                                <td className="py-2 pr-3 font-sans text-[13px] font-medium text-[#1C1917]">{item.nome}</td>
                                                <td className="px-2 py-2 text-center text-[#78716C]">
                                                    {item.qtd} {item.un}
                                                </td>
                                                {[0, 1, 2].map((col) => {
                                                    const cellP = seg(p, 0.24 + col * 0.14 + rowIdx * 0.015, 0.08);
                                                    return (
                                                        <td
                                                            key={col}
                                                            className={`px-3 py-2 text-center transition-colors ${col === WINNER_COL && reveal > 0 ? "bg-[#F97316]/[0.08] font-bold text-[#1C1917]" : ""}`}
                                                            style={{ opacity: cellP }}
                                                        >
                                                            {brl(item.precos[col])}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        <tr className="border-b border-[#D6D3D1] text-[13px]">
                                            <td className="py-2 pr-3 font-sans font-medium text-[#1C1917]">Frete</td>
                                            <td />
                                            {[0, 1, 2].map((col) => (
                                                <td key={col} className={`px-3 py-2 text-center ${col === WINNER_COL && reveal > 0 ? "bg-[#F97316]/[0.08]" : ""}`} style={{ opacity: seg(p, 0.66, 0.08) }}>
                                                    {FRETES[col] === 0 ? "CIF" : brl(FRETES[col])}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="font-bold text-[#1C1917]">
                                            <td className="py-2.5 pr-3 font-sans text-sm uppercase tracking-wide">Total geral</td>
                                            <td />
                                            {[0, 1, 2].map((col) => {
                                                const totP = seg(p, 0.7, 0.08);
                                                return (
                                                    <td key={col} className={`px-3 py-2.5 text-center ${col === WINNER_COL && reveal > 0 ? "border-2 border-[#F97316] bg-[#F97316]/[0.08]" : ""}`} style={{ opacity: totP }}>
                                                        {brl(Math.round(colTotal(col) * (reduced ? 1 : Math.min(1, totP * 1.5)) * 100) / 100)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="font-mono text-[11px] text-[#78716C]">
                                    condições lado a lado: à vista −3% · 28 dias · 28/56
                                </p>
                                <p className="font-mono text-sm font-bold text-[#15803D] transition-opacity" style={{ opacity: deltaP }}>
                                    <span className="border-b-2 border-[#15803D]">
                                        diferença entre maior e menor total: R$ {brl(DELTA_PROPOSTAS)}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#44403C]">
                        Unitário, total, frete, impostos e condições — lado a lado, sem truque. Você enxerga onde cada
                        real está e quanto deixa de gastar: em obras acompanhadas por 30 anos de suprimentos, a
                        diferença chega a <span className="font-mono font-bold text-[#15803D]">31%</span>.
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 7. Passo final — do clique ao canteiro                              */
/* ------------------------------------------------------------------ */

function OrdemDeCompra() {
    const { ref, inView } = useInView<HTMLDivElement>(0.3);

    return (
        <section className="bg-[#F1EDE7] px-6 py-24">
            <div ref={ref} className="mx-auto max-w-6xl">
                <SectionLabel>Passo final</SectionLabel>
                <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#1C1917] md:text-5xl">
                    Um clique e vira ordem de compra. Com data, aceite e nome dos dois lados.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#44403C]">
                    A OC sai formal: dados completos de fornecedor e cliente, autorização sua, aceite dele — tudo
                    datado. No fechamento, os dois lados se revelam. Daí em diante você acompanha faturamento, separação
                    e entrega em um só lugar, 100% transparente, até o material bater no canteiro.
                </p>

                <div className="mt-14 grid items-start gap-10 lg:grid-cols-5">
                    {/* Folha A4 */}
                    <div
                        className="relative rounded-sm bg-white p-6 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.4)] transition-all duration-700 lg:col-span-3"
                        style={{ transform: inView ? "rotateX(0deg)" : "rotateX(8deg)", opacity: inView ? 1 : 0, transformOrigin: "center top" }}
                    >
                        <div className="border-b-2 border-[#F97316] pb-2">
                            <p className="font-mono text-sm font-bold uppercase tracking-widest text-[#1C1917]">
                                Ordem de Compra Nº 2026-0347
                            </p>
                        </div>
                        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
                            <div className="border border-[#D6D3D1] p-3">
                                <p className="font-mono text-[9px] uppercase tracking-widest text-[#78716C]">Fornecedor · revelado</p>
                                <p className="mt-1 font-bold text-[#1C1917]">{WINNER_NAME}</p>
                                <p className="text-[#44403C]">CNPJ 00.000.000/0001-00 · Belo Horizonte/MG</p>
                            </div>
                            <div className="border border-[#D6D3D1] p-3">
                                <p className="font-mono text-[9px] uppercase tracking-widest text-[#78716C]">Faturar para</p>
                                <p className="mt-1 font-bold text-[#1C1917]">Construtora Vila Nova Ltda</p>
                                <p className="text-[#44403C]">Obra Residencial Vila Nova · entrega no canteiro</p>
                            </div>
                        </div>
                        <table className="mt-4 w-full border-collapse font-mono text-xs tabular-nums text-[#44403C]">
                            <tbody>
                                {MAP_ITEMS.slice(0, 3).map((item) => (
                                    <tr key={item.nome} className="border-b border-[#EDE9E3]">
                                        <td className="py-1.5 pr-2 font-sans text-[12px]">{item.nome}</td>
                                        <td className="px-2 py-1.5 text-center">{item.qtd} {item.un}</td>
                                        <td className="px-2 py-1.5 text-right">{brl(item.precos[WINNER_COL])}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold text-[#1C1917]">
                                    <td className="py-2 pr-2 font-sans text-[12px] uppercase">Valor total da nota</td>
                                    <td />
                                    <td className="px-2 py-2 text-right">R$ {brl(colTotal(WINNER_COL))}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="mt-6 grid grid-cols-2 gap-6 text-center font-mono text-[10px] uppercase tracking-widest text-[#78716C]">
                            <div className="border-t border-[#1C1917] pt-1">autorização do cliente</div>
                            <div className="border-t border-[#1C1917] pt-1">aceite do fornecedor</div>
                        </div>
                        {/* Carimbo */}
                        <div
                            className="absolute -right-3 top-16 rotate-[-8deg] rounded border-4 border-[#F97316] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-[#F97316] transition-all duration-500"
                            style={{ transitionDelay: "600ms", transform: inView ? "rotate(-8deg) scale(1)" : "rotate(0deg) scale(1.4)", opacity: inView ? 1 : 0 }}
                        >
                            Autorizada · aceite em 10/08
                        </div>
                    </div>

                    {/* Cronograma */}
                    <div className="lg:col-span-2">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#78716C]">acompanhamento do pedido</p>
                        <ol className="mt-4 space-y-5">
                            {[
                                { label: "Pedido aceito", data: "10/08 · 09h41", done: true },
                                { label: "Faturado", data: "10/08 · 14h20", done: true },
                                { label: "Em separação", data: "11/08 · 08h00", done: true },
                                { label: "Entregue no canteiro", data: "12/08 · previsão", done: false },
                            ].map((step, i) => (
                                <li key={step.label} className="flex items-center gap-3">
                                    <span
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-all duration-500 ${step.done ? "border-[#F97316] bg-[#F97316] text-white" : "border-[#D6D3D1] bg-white text-[#A8A29E]"}`}
                                        style={{ transitionDelay: `${400 + i * 200}ms`, transform: inView ? "scale(1)" : "scale(0.6)", opacity: inView ? 1 : 0 }}
                                    >
                                        {step.done ? "✓" : "4"}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-[#1C1917]">{step.label}</p>
                                        <p className="font-mono text-[11px] text-[#78716C]">{step.data}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#D6D3D1]">
                            <div
                                className="h-full rounded-full bg-[#F97316] transition-transform duration-1000 ease-out"
                                style={{ transform: `scaleX(${inView ? 0.75 : 0})`, transformOrigin: "left", transitionDelay: "800ms" }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 8. Contracapa — depoimento e números                                */
/* ------------------------------------------------------------------ */

function Contracapa() {
    const { ref, inView } = useInView<HTMLDivElement>(0.3);

    return (
        <section id="beneficios" className="bg-[#292524] px-6 py-28 text-[#FAF8F5]">
            <div ref={ref} className="mx-auto max-w-5xl">
                <div className="relative">
                    <span className="absolute -left-4 -top-10 select-none font-serif text-[120px] leading-none text-[#F97316]/70 md:-left-14" aria-hidden>
                        &ldquo;
                    </span>
                    <blockquote
                        className="text-2xl font-medium italic leading-relaxed text-[#FAF8F5] transition-all duration-700 md:text-4xl"
                        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(16px)" }}
                    >
                        Eu não sabia quanto eu perdia. Agora eu sei quanto eu economizo.
                    </blockquote>
                    <p className="mt-6 font-mono text-xs uppercase tracking-[0.25em] text-[#A8A29E]">
                        Quem compra obra há 30 anos — e destilou isso num processo
                    </p>
                </div>

                <p className="mt-10 max-w-3xl text-lg leading-relaxed text-[#D6D3D1]">
                    Quem compra obra passou a vida negociando no grito e conferindo no olho. A mudança não é só o número
                    no fim do mês — é decidir com o mapa aberto na mesa. São mais de 30 anos de suprimentos destilados
                    num processo que qualquer equipe opera no primeiro dia.
                </p>

                {/* Rodapé de relatório impresso */}
                <div className="mt-16 border-t-4 border-double border-[#FAF8F5]/40 pt-8">
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                        {[
                            { valor: 31, sufixo: "%", legenda: "economia máxima demonstrada" },
                            { valor: 19000, sufixo: "+", legenda: "materiais catalogados" },
                            { valor: 30, sufixo: "+", legenda: "anos de suprimentos" },
                            { valor: 100, sufixo: "%", legenda: "acompanhamento transparente" },
                        ].map((stat) => (
                            <div key={stat.legenda}>
                                <p className="font-mono text-4xl font-bold tabular-nums md:text-5xl">
                                    <Counter target={stat.valor} start={inView} />
                                    <span className="text-[#F97316]">{stat.sufixo}</span>
                                </p>
                                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8A29E]">
                                    {stat.legenda}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* 9. CTA — comece pela lista                                          */
/* ------------------------------------------------------------------ */

function Cta() {
    const { ref, inView } = useInView<HTMLDivElement>(0.3);

    return (
        <section className="border-t border-white/10 bg-[#292524] px-6 py-28 text-[#FAF8F5]">
            <div ref={ref} className="mx-auto max-w-3xl text-center">
                <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                    Monte sua primeira lista. A cotação a gente dispara hoje.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#D6D3D1]">
                    Suba sua planilha ou busque no catálogo — em minutos os fornecedores da sua região estão cotando, e
                    a primeira cotação já sai comparada no mapa. Fornecedor de materiais? Entre para a rede: aqui você
                    disputa pelo preço, não pelo assédio, e ganha pelo mérito.
                </p>

                {/* Primeira linha de uma lista vazia */}
                <div
                    className="mx-auto mt-10 flex max-w-xl items-center gap-3 rounded-md border border-white/20 bg-[#1C1917] px-5 py-4 text-left font-mono text-sm text-[#A8A29E] transition-all duration-700"
                    style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(12px)" }}
                >
                    <span className="text-[#F97316]">001</span>
                    <span>o que sua obra precisa?</span>
                    <span className="lp-blink ml-0.5 inline-block h-4 w-[2px] bg-[#F97316]" aria-hidden />
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/login"
                        className="rounded-lg bg-[#F97316] px-8 py-4 text-base font-bold text-white shadow-[4px_4px_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 hover:bg-[#C2410C]"
                    >
                        Montar minha lista grátis
                    </Link>
                    <Link href="/login" className="text-base font-semibold text-[#D6D3D1] underline decoration-[#F97316] decoration-2 underline-offset-4 hover:text-white">
                        Quero cotar como fornecedor
                    </Link>
                </div>

                <p className="mt-12 font-mono text-sm italic tracking-wide text-[#A8A29E]">
                    economizamos para você<span className="text-[#F97316]">.</span>
                </p>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

export function LandingExperience() {
    return (
        <main className="bg-[#FAF8F5] text-[#1C1917]">
            <Hero />
            <Thread />
            <Dor />
            <Lista />
            <Thread />
            <Madrugada />
            <Etica />
            <MapaCentral />
            <Thread />
            <OrdemDeCompra />
            <Contracapa />
            <Cta />
        </main>
    );
}
