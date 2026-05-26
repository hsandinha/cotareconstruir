"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, Home, Search, X } from "lucide-react";

export interface TocItem {
    id: string;
    text: string;
    depth: number;
}

interface TocNode extends TocItem {
    children: TocNode[];
}

interface Props {
    html: string;
    toc: TocItem[];
}

function buildTree(items: TocItem[]): TocNode[] {
    const root: TocNode[] = [];
    const stack: TocNode[] = [];

    for (const item of items) {
        const node: TocNode = { ...item, children: [] };
        while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            root.push(node);
        } else {
            stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
    }

    return root;
}

function flatten(nodes: TocNode[]): TocItem[] {
    const out: TocItem[] = [];
    const walk = (list: TocNode[]) => {
        for (const n of list) {
            out.push({ id: n.id, text: n.text, depth: n.depth });
            if (n.children.length) walk(n.children);
        }
    };
    walk(nodes);
    return out;
}

export default function ApiDocsClient({ html, toc }: Props) {
    const tree = useMemo(() => buildTree(toc), [toc]);
    const flat = useMemo(() => flatten(tree), [tree]);

    const [search, setSearch] = useState("");
    const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
        const map: Record<string, boolean> = {};
        tree.forEach((n) => {
            map[n.id] = true;
        });
        return map;
    });
    const [activeId, setActiveId] = useState<string>("");
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Scroll-spy
    useEffect(() => {
        const ids = flat.map((i) => i.id);
        const elements = ids
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => Boolean(el));

        if (elements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
        );

        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [flat]);

    // Enhance content: copy buttons on <pre>, method badges, smooth scroll
    useEffect(() => {
        if (!contentRef.current) return;

        const root = contentRef.current;

        // Add copy buttons to code blocks
        const pres = root.querySelectorAll("pre");
        pres.forEach((pre) => {
            if (pre.querySelector(".copy-btn")) return;
            const btn = document.createElement("button");
            btn.className =
                "copy-btn absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 opacity-0 transition-opacity hover:bg-slate-700 group-hover:opacity-100";
            btn.textContent = "Copiar";
            btn.type = "button";
            btn.addEventListener("click", async () => {
                const code = pre.querySelector("code")?.textContent ?? "";
                try {
                    await navigator.clipboard.writeText(code);
                    btn.textContent = "Copiado!";
                    setTimeout(() => {
                        btn.textContent = "Copiar";
                    }, 1500);
                } catch {
                    btn.textContent = "Erro";
                }
            });
            pre.classList.add("group", "relative");
            pre.appendChild(btn);

            // Add method badge for HTTP code blocks
            const code = pre.querySelector("code.language-http");
            if (code) {
                const firstLine = code.textContent?.split("\n")[0] ?? "";
                const m = firstLine.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/);
                if (m) {
                    const [, method, pathStr] = m;
                    const colors: Record<string, string> = {
                        GET: "bg-emerald-500 text-white",
                        POST: "bg-blue-500 text-white",
                        PUT: "bg-amber-500 text-white",
                        PATCH: "bg-purple-500 text-white",
                        DELETE: "bg-rose-500 text-white",
                    };
                    const badge = document.createElement("div");
                    badge.className =
                        "endpoint-badge -mt-1 mb-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm";
                    badge.innerHTML = `<span class="rounded px-2 py-0.5 text-xs font-bold tracking-wider ${colors[method]}">${method}</span><span class="text-slate-700">${pathStr}</span>`;
                    pre.parentElement?.insertBefore(badge, pre);
                    pre.style.display = "none";
                }
            }
        });
    }, [html]);

    const filterMatches = (text: string): boolean => {
        if (!search.trim()) return true;
        return text.toLowerCase().includes(search.toLowerCase().trim());
    };

    const renderNode = (node: TocNode, isTopLevel = false) => {
        const hasChildren = node.children.length > 0;
        const open = openMap[node.id] ?? true;
        const isActive = activeId === node.id;

        // Search filter: show if self matches OR any descendant matches
        const matchSelf = filterMatches(node.text);
        const matchDescendant = (n: TocNode): boolean => {
            if (filterMatches(n.text)) return true;
            return n.children.some(matchDescendant);
        };
        const visible = matchSelf || node.children.some(matchDescendant);
        if (!visible) return null;

        const forceOpen = search.trim().length > 0;

        return (
            <li key={node.id}>
                <div className="flex items-center">
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={() =>
                                setOpenMap((prev) => ({ ...prev, [node.id]: !(prev[node.id] ?? true) }))
                            }
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label={open ? "Recolher" : "Expandir"}
                        >
                            {forceOpen || open ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                            )}
                        </button>
                    ) : (
                        <span className="h-6 w-6 shrink-0" />
                    )}
                    <a
                        href={`#${node.id}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={`flex-1 truncate rounded px-2 py-1 text-sm transition-colors ${isActive
                                ? "bg-emerald-50 font-semibold text-emerald-700"
                                : isTopLevel
                                    ? "font-semibold text-slate-900 hover:bg-slate-100"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                        title={node.text}
                    >
                        {node.text}
                    </a>
                </div>
                {hasChildren && (forceOpen || open) && (
                    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                        {node.children.map((child) => renderNode(child))}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen((v) => !v)}
                            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                            aria-label="Abrir menu"
                        >
                            {mobileNavOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                        </button>
                        <Link href="/" className="flex items-center gap-2">
                            <Image
                                src="/logo.png"
                                alt="Cotar e Construir"
                                width={36}
                                height={36}
                                className="h-9 w-9 rounded-lg object-contain"
                                priority
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="text-sm font-bold text-slate-900">Cotar e Construir</span>
                                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">
                                    API Docs · v1
                                </span>
                            </div>
                        </Link>
                    </div>

                    <div className="hidden flex-1 max-w-md md:block">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar na documentação..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/"
                            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
                        >
                            <Home className="h-4 w-4" />
                            Site
                        </Link>
                        <Link
                            href="/dashboard/fornecedor"
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                            Dashboard
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>

                {/* Mobile search */}
                <div className="border-t border-slate-200 px-4 py-2 md:hidden">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:outline-none"
                        />
                    </div>
                </div>
            </header>

            <div className="mx-auto flex max-w-[90rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
                {/* Sidebar */}
                <aside
                    className={`${mobileNavOpen
                            ? "fixed inset-x-0 top-[64px] z-20 h-[calc(100vh-64px)] bg-white p-4 lg:relative lg:inset-auto lg:top-auto lg:h-auto lg:bg-transparent lg:p-0"
                            : "hidden lg:block"
                        } w-full shrink-0 lg:w-72`}
                >
                    <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Conteúdo
                            </p>
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="text-xs text-slate-400 hover:text-slate-700"
                                >
                                    limpar
                                </button>
                            )}
                        </div>
                        <ul className="space-y-1">
                            {tree.map((node) => renderNode(node, true))}
                        </ul>
                    </nav>
                </aside>

                {/* Main content */}
                <main className="min-w-0 flex-1">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                        <div
                            ref={contentRef}
                            className="api-docs-content"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />

                        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <Image
                                        src="/logo.png"
                                        alt=""
                                        width={20}
                                        height={20}
                                        className="h-5 w-5 rounded object-contain"
                                    />
                                    <span>
                                        © {new Date().getFullYear()} Cotar e Construir · API v1
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <Link href="/termos" className="hover:text-slate-900">
                                        Termos
                                    </Link>
                                    <Link href="/privacidade" className="hover:text-slate-900">
                                        Privacidade
                                    </Link>
                                    <Link href="/ajuda" className="hover:text-slate-900">
                                        Suporte
                                    </Link>
                                </div>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>

            <style jsx global>{`
                .api-docs-content h1 { font-size: 2.25rem; font-weight: 800; color: #0f172a; margin-bottom: 1rem; letter-spacing: -0.025em; }
                .api-docs-content h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-top: 2.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; letter-spacing: -0.02em; }
                .api-docs-content h3 { font-size: 1.2rem; font-weight: 700; color: #1e293b; margin-top: 2rem; margin-bottom: 0.5rem; }
                .api-docs-content h4 { font-size: 1rem; font-weight: 600; color: #1e293b; margin-top: 1.5rem; margin-bottom: 0.5rem; }
                .api-docs-content p { color: #475569; line-height: 1.7; margin: 0.75rem 0; }
                .api-docs-content ul, .api-docs-content ol { color: #475569; margin: 0.75rem 0; padding-left: 1.5rem; }
                .api-docs-content ul { list-style: disc; }
                .api-docs-content ol { list-style: decimal; }
                .api-docs-content li { margin: 0.25rem 0; line-height: 1.65; }
                .api-docs-content strong { color: #0f172a; font-weight: 600; }
                .api-docs-content blockquote { border-left: 4px solid #10b981; background: #ecfdf5; padding: 0.75rem 1rem; margin: 1rem 0; color: #065f46; border-radius: 0 0.5rem 0.5rem 0; }
                .api-docs-content h1 a, .api-docs-content h2 a, .api-docs-content h3 a, .api-docs-content h4 a { color: inherit; text-decoration: none; }
                .api-docs-content h2:hover a::after,
                .api-docs-content h3:hover a::after { content: ' #'; color: #10b981; font-weight: 400; }
                .api-docs-content hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
            `}</style>
        </div>
    );
}
