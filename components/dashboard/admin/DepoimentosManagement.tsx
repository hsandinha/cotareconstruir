"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    MessageSquareQuote, Plus, Pencil, Trash2, Eye, EyeOff, X, Save,
    Loader2, Upload, GripVertical, Film,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmModal } from "@/components/ConfirmModal";
import { getAuthHeaders } from "@/lib/authHeaders";
import {
    uploadArquivoDepoimento, removerArquivoDepoimento, lerDuracaoDoVideo,
    formatarDuracao, legendaDoAutor,
    VIDEO_ACCEPT, POSTER_ACCEPT, VIDEO_MAX_MB, POSTER_MAX_MB,
    type Depoimento,
} from "@/lib/depoimentos";

type Form = {
    id: string | null;
    nome: string;
    cargo: string;
    empresa: string;
    obra: string;
    citacao: string;
    videoUrl: string;
    posterUrl: string;
    duracaoSegundos: number | null;
    ativo: boolean;
};

const FORM_VAZIO: Form = {
    id: null, nome: "", cargo: "", empresa: "", obra: "", citacao: "",
    videoUrl: "", posterUrl: "", duracaoSegundos: null, ativo: true,
};

/**
 * Depoimentos em vídeo exibidos na página inicial.
 * O arquivo vai direto do navegador para o Storage; aqui gravamos só a URL.
 */
export function DepoimentosManagement() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();

    const [depoimentos, setDepoimentos] = useState<Depoimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enviandoVideo, setEnviandoVideo] = useState(false);
    const [enviandoPoster, setEnviandoPoster] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Form>(FORM_VAZIO);
    // Reordenação por arraste: item sendo puxado e linha sob o cursor
    const [arrastando, setArrastando] = useState<number | null>(null);
    const [alvo, setAlvo] = useState<number | null>(null);

    const videoInputRef = useRef<HTMLInputElement | null>(null);
    const posterInputRef = useRef<HTMLInputElement | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/depoimentos", { headers, credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar depoimentos");
            setDepoimentos(json.data || []);
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao carregar depoimentos.");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const chamarApi = async (payload: Record<string, unknown>, sucesso: string) => {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/admin/depoimentos", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Falha na operação");
        if (sucesso) showToast("success", sucesso);
        await load();
        return json;
    };

    const abrirNovo = () => { setForm(FORM_VAZIO); setShowForm(true); };

    const abrirEdicao = (d: Depoimento) => {
        setForm({
            id: d.id,
            nome: d.nome,
            cargo: d.cargo || "",
            empresa: d.empresa || "",
            obra: d.obra || "",
            citacao: d.citacao || "",
            videoUrl: d.video_url,
            posterUrl: d.poster_url || "",
            duracaoSegundos: d.duracao_segundos,
            ativo: d.ativo,
        });
        setShowForm(true);
    };

    const enviarVideo = async (file: File) => {
        setEnviandoVideo(true);
        try {
            // Duração lida do arquivo, para mostrar "2:14" no card da home
            const duracao = await lerDuracaoDoVideo(file);
            const url = await uploadArquivoDepoimento(file, "videos");
            setForm((prev) => ({ ...prev, videoUrl: url, duracaoSegundos: duracao }));
            showToast("success", "Vídeo carregado.");
        } catch (error: any) {
            showToast("error", error?.message || "Falha ao enviar o vídeo.");
        } finally {
            setEnviandoVideo(false);
            if (videoInputRef.current) videoInputRef.current.value = "";
        }
    };

    const enviarPoster = async (file: File) => {
        setEnviandoPoster(true);
        try {
            const url = await uploadArquivoDepoimento(file, "capas");
            setForm((prev) => ({ ...prev, posterUrl: url }));
            showToast("success", "Capa carregada.");
        } catch (error: any) {
            showToast("error", error?.message || "Falha ao enviar a capa.");
        } finally {
            setEnviandoPoster(false);
            if (posterInputRef.current) posterInputRef.current.value = "";
        }
    };

    const salvar = async () => {
        if (!form.nome.trim()) { showToast("error", "Informe o nome de quem deu o depoimento."); return; }
        if (!form.videoUrl) { showToast("error", "Carregue o vídeo do depoimento."); return; }

        setSaving(true);
        try {
            await chamarApi(
                {
                    action: form.id ? "update" : "create",
                    id: form.id,
                    nome: form.nome,
                    cargo: form.cargo,
                    empresa: form.empresa,
                    obra: form.obra,
                    citacao: form.citacao,
                    videoUrl: form.videoUrl,
                    posterUrl: form.posterUrl,
                    duracaoSegundos: form.duracaoSegundos,
                    ativo: form.ativo,
                    ordem: form.id ? undefined : depoimentos.length,
                },
                form.id ? "Depoimento atualizado." : "Depoimento publicado."
            );
            setShowForm(false);
            setForm(FORM_VAZIO);
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível salvar.");
        } finally {
            setSaving(false);
        }
    };

    const alternarPublicacao = async (d: Depoimento) => {
        try {
            await chamarApi(
                { action: "toggle_ativo", id: d.id, ativo: !d.ativo },
                d.ativo ? "Depoimento saiu da página inicial." : "Depoimento publicado na página inicial."
            );
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível alterar.");
        }
    };

    /** Move o item de `origem` para a posição `destino` e grava a nova ordem. */
    const reordenar = async (origem: number, destino: number) => {
        if (origem === destino || destino < 0 || destino >= depoimentos.length) return;

        const nova = [...depoimentos];
        const [movido] = nova.splice(origem, 1);
        nova.splice(destino, 0, movido);
        setDepoimentos(nova); // resposta imediata; a API confirma em seguida

        try {
            await chamarApi({ action: "reordenar", ids: nova.map((d) => d.id) }, "");
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível reordenar.");
            await load(); // desfaz o otimismo se o banco recusar
        }
    };

    const aoIniciarArraste = (indice: number) => (e: React.DragEvent) => {
        setArrastando(indice);
        e.dataTransfer.effectAllowed = "move";
        // Firefox só inicia o arraste se algo for escrito no dataTransfer
        e.dataTransfer.setData("text/plain", String(indice));
    };

    const aoPassarPor = (indice: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (arrastando !== null && indice !== alvo) setAlvo(indice);
    };

    const aoSoltar = (indice: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        const origem = arrastando;
        setArrastando(null);
        setAlvo(null);
        if (origem !== null) await reordenar(origem, indice);
    };

    const encerrarArraste = () => { setArrastando(null); setAlvo(null); };

    /**
     * Teclado no mesmo punho de arraste: sem os botões de seta, quem navega
     * por teclado ficaria sem como reordenar.
     */
    const aoTeclar = (indice: number) => (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        void reordenar(indice, indice + (e.key === "ArrowUp" ? -1 : 1));
    };

    const excluir = async (d: Depoimento) => {
        const ok = await confirmModal({
            title: "Excluir depoimento?",
            message: `O depoimento de ${d.nome} sai da página inicial e o vídeo é apagado do servidor. Esta ação não pode ser desfeita.`,
            confirmLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "danger",
        });
        if (ok !== true) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/depoimentos?id=${encodeURIComponent(d.id)}`, {
                method: "DELETE", headers, credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Falha ao excluir");

            // Só depois de o registro sair é que apagamos os arquivos
            await removerArquivoDepoimento(d.video_url);
            await removerArquivoDepoimento(d.poster_url);

            showToast("success", "Depoimento excluído.");
            await load();
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível excluir.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando depoimentos...
            </div>
        );
    }

    const publicados = depoimentos.filter((d) => d.ativo).length;
    const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
    const labelClass = "mb-1 block text-xs font-medium text-slate-600";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        <MessageSquareQuote className="h-5 w-5 text-orange-500" />
                        Depoimentos
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Vídeos exibidos na página inicial. {publicados} publicado{publicados === 1 ? "" : "s"} de {depoimentos.length}.
                    </p>
                </div>
                <button
                    onClick={abrirNovo}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" />
                    Novo depoimento
                </button>
            </div>

            {depoimentos.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <Film className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-700">Nenhum depoimento cadastrado</h3>
                    <p className="mb-4 mt-1 text-sm text-slate-500">
                        A seção só aparece na página inicial quando houver ao menos um depoimento publicado.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {depoimentos.length > 1 && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                            <GripVertical className="h-3.5 w-3.5" />
                            Arraste um vídeo para mudar a ordem em que ele aparece na página inicial.
                        </p>
                    )}
                    {depoimentos.map((d, indice) => (
                        <div
                            key={d.id}
                            onDragOver={aoPassarPor(indice)}
                            onDrop={aoSoltar(indice)}
                            className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 shadow-sm transition-all
                                ${d.ativo ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}
                                ${arrastando === indice ? "opacity-40" : ""}
                                ${alvo === indice && arrastando !== null && arrastando !== indice ? "border-blue-400 ring-2 ring-blue-200" : ""}`}
                        >
                            {/* Prévia — é por aqui que se arrasta para reordenar */}
                            <div
                                draggable
                                onDragStart={aoIniciarArraste(indice)}
                                onDragEnd={encerrarArraste}
                                onKeyDown={aoTeclar(indice)}
                                tabIndex={0}
                                role="button"
                                aria-label={`Reordenar depoimento de ${d.nome}. Arraste, ou use as setas para cima e para baixo.`}
                                title="Arraste para reordenar"
                                className="group relative h-24 w-40 shrink-0 cursor-grab overflow-hidden rounded-lg bg-slate-900 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                            >
                                {d.poster_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={d.poster_url} alt="" draggable={false} className="h-full w-full object-cover" />
                                ) : (
                                    <video src={d.video_url} preload="metadata" muted className="h-full w-full object-cover" />
                                )}

                                {/* Dica do punho de arraste, ao passar o mouse */}
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/40 group-hover:opacity-100 group-focus:bg-slate-900/40 group-focus:opacity-100">
                                    <GripVertical className="h-6 w-6 text-white drop-shadow" />
                                </span>

                                {d.duracao_segundos ? (
                                    <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                                        {formatarDuracao(d.duracao_segundos)}
                                    </span>
                                ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-900">{d.nome}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                        {d.ativo ? "Publicado" : "Rascunho"}
                                    </span>
                                </div>
                                {legendaDoAutor(d) && (
                                    <p className="mt-0.5 text-xs text-slate-500">{legendaDoAutor(d)}</p>
                                )}
                                {d.citacao && (
                                    <p className="mt-2 line-clamp-2 text-sm italic text-slate-600">“{d.citacao}”</p>
                                )}
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => alternarPublicacao(d)}
                                    title={d.ativo ? "Tirar da página inicial" : "Publicar na página inicial"}
                                    className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                                >
                                    {d.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => abrirEdicao(d)}
                                    title="Editar"
                                    className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => excluir(d)}
                                    title="Excluir"
                                    className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Formulário */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {form.id ? "Editar depoimento" : "Novo depoimento"}
                                </h2>
                                <p className="text-sm text-slate-500">O vídeo aparece na página inicial, antes do convite para o teste.</p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-5 p-5">
                            {/* Vídeo */}
                            <div>
                                <label className={labelClass}>Vídeo do depoimento *</label>
                                <input
                                    ref={videoInputRef}
                                    type="file"
                                    accept={VIDEO_ACCEPT}
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarVideo(f); }}
                                />
                                {form.videoUrl ? (
                                    <div className="rounded-xl border border-slate-200 p-3">
                                        <video
                                            src={form.videoUrl}
                                            poster={form.posterUrl || undefined}
                                            controls
                                            preload="metadata"
                                            className="max-h-56 w-full rounded-lg bg-black"
                                        />
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-xs text-slate-500">
                                                {form.duracaoSegundos ? `Duração ${formatarDuracao(form.duracaoSegundos)}` : "Vídeo carregado"}
                                            </span>
                                            <button
                                                onClick={() => videoInputRef.current?.click()}
                                                disabled={enviandoVideo}
                                                className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                                            >
                                                Trocar vídeo
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => videoInputRef.current?.click()}
                                        disabled={enviandoVideo}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 text-sm font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"
                                    >
                                        {enviandoVideo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                        {enviandoVideo ? "Enviando vídeo..." : `Carregar vídeo (MP4 ou WebM, até ${VIDEO_MAX_MB}MB)`}
                                    </button>
                                )}
                            </div>

                            {/* Capa */}
                            <div>
                                <label className={labelClass}>Capa do vídeo (opcional)</label>
                                <input
                                    ref={posterInputRef}
                                    type="file"
                                    accept={POSTER_ACCEPT}
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarPoster(f); }}
                                />
                                <div className="flex items-center gap-3">
                                    {form.posterUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={form.posterUrl} alt="" className="h-16 w-28 rounded-lg object-cover" />
                                    )}
                                    <button
                                        onClick={() => posterInputRef.current?.click()}
                                        disabled={enviandoPoster}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        {enviandoPoster ? "Enviando..." : form.posterUrl ? "Trocar capa" : `Escolher capa (até ${POSTER_MAX_MB}MB)`}
                                    </button>
                                    {form.posterUrl && (
                                        <button
                                            onClick={() => setForm({ ...form, posterUrl: "" })}
                                            className="text-xs text-slate-400 hover:text-red-600"
                                        >
                                            Remover
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                    Sem capa, o navegador mostra o primeiro quadro do vídeo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Nome *</label>
                                    <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} placeholder="Ex.: Maria Palhares" />
                                </div>
                                <div>
                                    <label className={labelClass}>Cargo</label>
                                    <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className={inputClass} placeholder="Ex.: Engenheira Civil" />
                                </div>
                                <div>
                                    <label className={labelClass}>Empresa</label>
                                    <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className={inputClass} placeholder="Ex.: Construtora Palhares" />
                                </div>
                                <div>
                                    <label className={labelClass}>Obra</label>
                                    <input value={form.obra} onChange={(e) => setForm({ ...form, obra: e.target.value })} className={inputClass} placeholder="Ex.: Residencial Havaí" />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Frase de destaque</label>
                                <textarea
                                    rows={3}
                                    value={form.citacao}
                                    onChange={(e) => setForm({ ...form, citacao: e.target.value })}
                                    className={inputClass}
                                    placeholder="Trecho curto do depoimento, exibido junto do vídeo."
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    Aparece na página e é o que quem não dá play — e quem usa leitor de tela — vai ler.
                                </p>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.ativo}
                                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300"
                                />
                                Publicar na página inicial
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                            <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button
                                onClick={salvar}
                                disabled={saving || enviandoVideo}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
