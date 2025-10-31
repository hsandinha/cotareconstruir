import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBrain, faTruck, faUser } from "@fortawesome/free-solid-svg-icons";
import { clientProcess, intelligencePoints, supplierProcess } from "../lib/content";

export function MethodologySection() {
  return (
    <section id="metodologia" className="section-anchor relative bg-slate-950/60 py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            3.0 Metodologia
          </span>
          <h2 className="mt-6 text-4xl font-bold text-white md:text-5xl">
            Como funciona nossa metodologia
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Um processo inteligente que combina tecnologia avançada com expertise de mercado para garantir
            resultados superiores.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          <div className="tilt-card relative rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow opacity-0 animate-fade-in-up">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
              <FontAwesomeIcon icon={faUser} className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-white">Para o Cliente</h3>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {clientProcess.map((step, index) => (
                <li key={step} className="flex items-start space-x-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="tilt-card relative rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow opacity-0 animate-fade-in-up">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <FontAwesomeIcon icon={faTruck} className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-white">Para o Fornecedor</h3>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {supplierProcess.map((step, index) => (
                <li key={step} className="flex items-start space-x-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="tilt-card relative overflow-hidden rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent p-8 shadow-glow opacity-0 animate-fade-in-up">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <FontAwesomeIcon icon={faBrain} className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-white">Inteligência da Plataforma</h3>
            <ul className="mt-6 space-y-4 text-sm text-slate-200">
              {intelligencePoints.map((item) => (
                <li key={item.label} className="flex items-center space-x-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cyan-200">
                    <FontAwesomeIcon icon={item.icon} className="text-sm" />
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
