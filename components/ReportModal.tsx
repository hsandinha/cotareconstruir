"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/components/ToastProvider";
import { AlertCircle, X, ShieldAlert, CheckCircle2 } from "lucide-react";

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: "fornecedor" | "obra" | "usuario" | "plataforma";
    targetId?: string;
    contextName?: string;
}

export function ReportModal({ isOpen, onClose, targetType, targetId, contextName }: ReportModalProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({
        type: "abuso",
        reason: "",
        description: "",
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            showToast("error", "Você precisa estar logado para enviar uma denúncia.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from("reports").insert({
                type: form.type,
                reason: form.reason || `Problema com ${targetType}`,
                description: form.description,
                status: "pending",
                reporter_id: user.id,
                target_type: targetType,
                target_id: targetId || null,
            });

            if (error) throw error;

            setSuccess(true);
            showToast("success", "Sua denúncia foi registrada. Nossa equipe de moderação analisará em breve.");
            
            // Auto close after 3s
            setTimeout(() => {
                setSuccess(false);
                setForm({ type: "abuso", reason: "", description: "" });
                onClose();
            }, 3000);
        } catch (error) {
            console.error("Erro ao enviar denúncia:", error);
            showToast("error", "Falha ao registrar a denúncia. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 p-2 rounded-full">
                            <ShieldAlert className="w-6 h-6 text-rose-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-rose-900">Reportar Problema</h2>
                            {contextName && (
                                <p className="text-sm font-medium text-rose-700 mt-0.5">
                                    Denunciando: {contextName}
                                </p>
                            )}
                        </div>
                    </div>
                    {!success && (
                        <button
                            onClick={onClose}
                            className="p-2 text-rose-400 hover:bg-rose-100/50 hover:text-rose-600 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {success ? (
                    <div className="p-8 text-center flex flex-col items-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Denúncia Recebida</h3>
                        <p className="text-slate-600">
                            Agradecemos por nos informar. Vamos investigar a ocorrência o mais rápido possível.
                        </p>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="mb-6 rounded-lg bg-red-50 p-4 flex gap-3 border border-red-100">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">
                                Utilize este canal apenas para enviar denúncias verdadeiras. Casos de má-fé podem resultar na suspensão da sua conta.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Tipo de Ocorrência
                                </label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 focus:border-rose-500 focus:ring-rose-200 outline-none transition-all"
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                                >
                                    <option value="abuso">Abuso de Sistema / Comportamento Tóxico</option>
                                    <option value="fraude">Suspeita de Fraude / Golpe</option>
                                    <option value="conteudo">Conteúdo Inadequado / Falso</option>
                                    <option value="problema_tecnico">Problema Técnico Grave</option>
                                    <option value="outro">Outro (Especificar abaixo)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Título Breve / Motivo Principal
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: Fornecedor tentou desviar pagamento"
                                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-rose-500 focus:ring-rose-200 outline-none transition-all"
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Descrição Detalhada
                                </label>
                                <textarea
                                    required
                                    placeholder="Por favor, explique com o máximo de detalhes possível o que aconteceu..."
                                    rows={4}
                                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-rose-500 focus:ring-rose-200 outline-none transition-all resize-none"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm focus:ring-4 focus:ring-rose-100 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>Enviando...</>
                                    ) : (
                                        <>Enviar Denúncia</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
