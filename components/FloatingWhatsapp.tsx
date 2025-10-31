import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { floatingWhatsApp } from "../lib/content";

function buildWhatsAppUrl(phone: string, message: string) {
  const searchParams = new URLSearchParams({ text: message });
  return `https://wa.me/${phone}?${searchParams.toString()}`;
}

export function FloatingWhatsapp() {
  const href = buildWhatsAppUrl(floatingWhatsApp.phone, floatingWhatsApp.message);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed bottom-6 right-6 z-50 flex items-center space-x-3 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-2xl shadow-emerald-500/40 transition-transform duration-300 hover:-translate-y-1 hover:bg-emerald-400"
      aria-label={floatingWhatsApp.label}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 transition duration-300 group-hover:bg-white/30">
        <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
      </span>
      <span className="text-sm font-semibold">{floatingWhatsApp.label}</span>
    </Link>
  );
}
