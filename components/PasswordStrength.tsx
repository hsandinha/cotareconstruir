"use client";

/**
 * PasswordStrengthIndicator — Visual feedback for password strength
 * Shows a progress bar and checkmarks for each requirement met.
 */

interface PasswordStrengthProps {
    password: string;
    className?: string;
}

const REQUIREMENTS = [
    { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Número", test: (p: string) => /[0-9]/.test(p) },
    { label: "Caractere especial", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function PasswordStrengthIndicator({ password, className = "" }: PasswordStrengthProps) {
    if (!password) return null;

    const passed = REQUIREMENTS.filter((r) => r.test(password)).length;
    const total = REQUIREMENTS.length;
    const percentage = (passed / total) * 100;

    const strengthLabel =
        passed <= 1 ? "Muito fraca" :
        passed <= 2 ? "Fraca" :
        passed <= 3 ? "Média" :
        passed <= 4 ? "Boa" :
        "Forte";

    const strengthColor =
        passed <= 1 ? "bg-red-500" :
        passed <= 2 ? "bg-orange-500" :
        passed <= 3 ? "bg-amber-500" :
        passed <= 4 ? "bg-blue-500" :
        "bg-emerald-500";

    const textColor =
        passed <= 2 ? "text-red-600" :
        passed <= 3 ? "text-amber-600" :
        "text-emerald-600";

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Strength bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${strengthColor}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <span className={`text-[10px] font-semibold ${textColor} min-w-[60px] text-right`}>
                    {strengthLabel}
                </span>
            </div>

            {/* Requirements list */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {REQUIREMENTS.map((req) => {
                    const met = req.test(password);
                    return (
                        <div
                            key={req.label}
                            className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
                                met ? "text-emerald-600" : "text-slate-400"
                            }`}
                        >
                            <svg
                                viewBox="0 0 16 16"
                                className={`w-3 h-3 shrink-0 transition-transform duration-200 ${met ? "scale-100" : "scale-75"}`}
                                fill="currentColor"
                            >
                                {met ? (
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Zm-1.1-4L4.2 8.3l1-1 1.7 1.7 3.9-3.9 1 1L6.9 11Z" />
                                ) : (
                                    <circle cx="8" cy="8" r="3" opacity="0.4" />
                                )}
                            </svg>
                            <span>{req.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
