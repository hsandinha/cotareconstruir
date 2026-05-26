import fs from "node:fs/promises";
import path from "node:path";
import { marked, type Tokens } from "marked";
import ApiDocsClient, { type TocItem } from "./ApiDocsClient";

export const metadata = {
    title: "Documentação da API · Cotar e Construir",
    description: "Documentação técnica da API de fornecedores da plataforma Cotar e Construir.",
};

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function renderDoc(): Promise<{ html: string; toc: TocItem[] }> {
    const filePath = path.join(process.cwd(), "docs", "fornecedor-materiais-api.md");
    const markdown = await fs.readFile(filePath, "utf8");

    const toc: TocItem[] = [];
    const usedIds = new Map<string, number>();

    const renderer = new marked.Renderer();

    renderer.heading = ({ tokens, depth }: Tokens.Heading) => {
        const text = tokens.map((t: any) => ("text" in t ? t.text : "")).join("");
        let id = slugify(text);
        const count = usedIds.get(id) ?? 0;
        usedIds.set(id, count + 1);
        if (count > 0) id = `${id}-${count}`;
        if (depth <= 3) toc.push({ id, text, depth });
        const inline = marked.parseInline(text) as string;
        return `<h${depth} id="${id}" class="scroll-mt-24"><a href="#${id}">${inline}</a></h${depth}>\n`;
    };

    renderer.table = ({ header, rows }: Tokens.Table) => {
        const headerHtml = header
            .map(
                (cell) =>
                    `<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">${marked.parseInline(cell.text)}</th>`
            )
            .join("");
        const bodyHtml = rows
            .map(
                (row) =>
                    `<tr class="border-b border-slate-100">${row
                        .map(
                            (cell) =>
                                `<td class="px-3 py-2 align-top text-sm text-slate-700">${marked.parseInline(cell.text)}</td>`
                        )
                        .join("")}</tr>`
            )
            .join("");
        return `<div class="my-4 overflow-x-auto rounded-lg border border-slate-200"><table class="w-full border-collapse text-sm"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>\n`;
    };

    renderer.code = ({ text, lang }: Tokens.Code) => {
        const language = lang || "";
        return `<pre class="my-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
    };

    renderer.codespan = ({ text }: Tokens.Codespan) =>
        `<code class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] font-mono text-rose-700">${escapeHtml(text)}</code>`;

    renderer.link = ({ href, title, tokens }: Tokens.Link) => {
        const text = tokens.map((t: any) => ("text" in t ? t.text : "")).join("");
        const inline = marked.parseInline(text);
        const titleAttr = title ? ` title="${title}"` : "";
        const external = href?.startsWith("http");
        const target = external ? ` target="_blank" rel="noopener noreferrer"` : "";
        return `<a href="${href}"${titleAttr}${target} class="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800">${inline}</a>`;
    };

    const html = await marked.parse(markdown, { renderer, gfm: true, breaks: false });

    return { html: html as string, toc };
}

export default async function ApiDocsPage() {
    const { html, toc } = await renderDoc();
    return <ApiDocsClient html={html} toc={toc} />;
}
