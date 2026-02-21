import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { footerLinks } from "../lib/content";

export function Footer() {
  return (
    <footer id="contato" className="section-anchor relative bg-slate-950 py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="#hero" className="flex items-center space-x-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95">
                <Image src="/logo.png" alt="Cotar & Construir" width={28} height={28} />
              </span>
              <span className="text-xl font-bold">Cotar & Construir</span>
            </Link>
            <p className="text-sm text-slate-400">
              Transformando a maneira como você constrói. Conectamos obras a fornecedores com tecnologia e eficiência.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Solução</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              {footerLinks.solution.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Empresa</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              {footerLinks.company.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Contato</h3>
            <div className="space-y-3 text-sm text-slate-400">
              <div className="flex items-center space-x-3">
                <FontAwesomeIcon icon={faEnvelope} className="text-blue-400" />
                <span>contato@cotareconstruir.com</span>
              </div>
              <div className="flex items-center space-x-3">
                <FontAwesomeIcon icon={faPhone} className="text-blue-400" />
                <span>(11) 9999-9999</span>
              </div>
            </div>
            <div className="flex space-x-5 pt-2 text-lg text-slate-400">
              <Link href="#" className="transition hover:text-white" aria-label="LinkedIn">
                <FontAwesomeIcon icon={faLinkedin} />
              </Link>
              <Link href="#" className="transition hover:text-white" aria-label="Instagram">
                <FontAwesomeIcon icon={faInstagram} />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Cotar & Construir. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
