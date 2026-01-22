"use client";

import { useState } from "react";
import { submitDocument } from "../../../lib/services";
import { useAuth } from "../../../lib/useAuth";

export function SupplierVerificationSection() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState("cnpj");
    const [fileUrl, setFileUrl] = useState(""); // In a real app, this would be a file upload returning a URL

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // Mock file upload by just taking the string input as URL for now
            await submitDocument(user.id, docType, fileUrl);
            alert("Documento enviado para análise!");
            setFileUrl("");
        } catch (error) {
            alert("Erro ao enviar documento.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Verificação de Conta</h2>
            <p className="text-sm text-gray-500 mb-6">
                Para aumentar sua reputação e desbloquear mais recursos, envie seus documentos para verificação.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Documento</label>
                    <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                        <option value="cnpj">Cartão CNPJ</option>
                        <option value="identity">Identidade (RG/CNH)</option>
                        <option value="address">Comprovante de Endereço</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">URL do Documento (Simulação)</label>
                    <input
                        type="text"
                        value={fileUrl}
                        onChange={(e) => setFileUrl(e.target.value)}
                        placeholder="https://exemplo.com/meu-documento.pdf"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        * Em produção, isso seria um campo de upload de arquivo.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {loading ? "Enviando..." : "Enviar para Análise"}
                </button>
            </form>
        </div>
    );
}
