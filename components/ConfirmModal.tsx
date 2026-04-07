"use client";

import { useState, useCallback, ReactNode, createContext, useContext } from "react";

/**
 * ConfirmModal — Replaces native confirm() / prompt() with a polished modal.
 *
 * Usage via hook:
 *   const { confirm } = useConfirmModal();
 *   const ok = await confirm({ title: "Excluir?", message: "..." });
 */

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    /** If provided, shows a text input and returns the value instead of boolean */
    promptLabel?: string;
    promptPlaceholder?: string;
}

type ConfirmResult = boolean | string | null;

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirmModal() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirmModal must be used within ConfirmModalProvider");
    return ctx;
}

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [promptValue, setPromptValue] = useState("");
    const [resolver, setResolver] = useState<((value: ConfirmResult) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<ConfirmResult> => {
        setOptions(opts);
        setPromptValue("");
        setIsOpen(true);
        return new Promise<ConfirmResult>((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        if (options?.promptLabel) {
            resolver?.(promptValue || null);
        } else {
            resolver?.(true);
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (options?.promptLabel) {
            resolver?.(null);
        } else {
            resolver?.(false);
        }
    };

    const variant = options?.variant || "danger";

    const iconColors = {
        danger: "bg-red-100 text-red-600",
        warning: "bg-amber-100 text-amber-600",
        info: "bg-blue-100 text-blue-600",
    };

    const buttonColors = {
        danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        warning: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
        info: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    };

    const icons = {
        danger: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        ),
        warning: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
        ),
        info: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
        ),
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && options && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={handleCancel}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            {/* Icon + Title */}
                            <div className="flex items-start gap-4">
                                <div className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full ${iconColors[variant]}`}>
                                    {icons[variant]}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        {options.title}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                                        {options.message}
                                    </p>
                                </div>
                            </div>

                            {/* Optional prompt input */}
                            {options.promptLabel && (
                                <div className="mt-4 ml-[60px]">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        {options.promptLabel}
                                    </label>
                                    <textarea
                                        value={promptValue}
                                        onChange={(e) => setPromptValue(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                        placeholder={options.promptPlaceholder || ""}
                                        rows={3}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                {options.cancelLabel || "Cancelar"}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={options.promptLabel ? !promptValue.trim() : false}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${buttonColors[variant]}`}
                            >
                                {options.confirmLabel || "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
