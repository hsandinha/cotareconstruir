import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { footerLinks } from "../lib/content";

export function Footer() {
  return (
    <footer id="contato" className="section-anchor relative bg-slate-950 py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-5">
            <div className="flex items-center space-x-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-glow">
                <FontAwesomeIcon icon={faBuilding} className="text-lg text-white" />
              </span>
              <span className="text-xl font-bold">Cotar e Construir</span>
            </div>
            <p className="text-sm text-slate-400">
              Transformando a gestão de suprimentos da construção civil em vantagem estratégica.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Solução</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              {footerLinks.solution.map((item) => (
                <li key={item}>
                  <Link href="#" className="transition hover:text-white">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Empresa</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              {footerLinks.company.map((item) => (
                <li key={item}>
                  <Link href="#" className="transition hover:text-white">
                    {item}
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
          © {new Date().getFullYear()} Cotar e Construir. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
