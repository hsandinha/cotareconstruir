"use client";

import { useState } from "react";
import { addReview } from "../lib/services";
import { auth } from "../lib/firebase";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierId: string;
    supplierName: string;
    orderId?: string;
}

export function ReviewModal({ isOpen, onClose, supplierId, supplierName, orderId }: ReviewModalProps) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            await addReview(auth.currentUser.uid, supplierId, rating, comment, orderId);
            alert("Avaliação enviada com sucesso!");
            onClose();
        } catch (error) {
            alert("Erro ao enviar avaliação.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Avaliar {supplierName}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nota</label>
                        <div className="flex space-x-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`text-2xl ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Comentário</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2"
                            rows={4}
                            placeholder="Como foi sua experiência?"
                            required
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? "Enviando..." : "Enviar Avaliação"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
