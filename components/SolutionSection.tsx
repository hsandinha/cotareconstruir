import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { solutionHighlights, solutionMedia } from "../lib/content";
import { staggerDelay } from "../lib/utils";

export function SolutionSection() {
  return (
    <section id="solucao" className="section-anchor relative py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 lg:grid-cols-2 lg:items-center">
        <div className="space-y-10">
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300">
              2.0 A Solução
            </span>
            <h2 className="text-4xl font-bold text-white md:text-5xl">
              Metodologia que transforma compras em vantagem estratégica
            </h2>
            <p className="text-lg leading-relaxed text-slate-300">
              Não somos apenas uma plataforma: entregamos uma metodologia operacional que eleva a
              gestão de suprimentos de uma tarefa tática para um mecanismo estratégico, combinando
              tecnologia, curadoria técnica e negociação profissional.
            </p>
          </div>

          <div className="space-y-6">
            {solutionHighlights.map((item, index) => (
              <div
                key={item.title}
                className="tilt-card relative flex transform-gpu items-start space-x-4 rounded-3xl border border-white/10 bg-white/5 p-6 opacity-0 transition animate-fade-in-up"
                style={{ animationDelay: staggerDelay(index, 0.15) }}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accentClass}`}
                >
                  <FontAwesomeIcon icon={item.icon} className="text-lg" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="#metodologia"
            className="shine inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-base font-semibold text-white shadow-glow transition-transform duration-300 hover:-translate-y-1"
          >
            Conhecer a Metodologia
          </Link>
        </div>

        <div className="tilt relative">
          <div className="tilt-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-glow">
            <Image
              src={solutionMedia.image.src}
              alt={solutionMedia.image.alt}
              width={720}
              height={520}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tl from-blue-900/25 via-transparent to-cyan-500/25" />
          </div>
          <div className="floating absolute top-6 right-6 rounded-2xl border border-white/20 bg-white/90 px-6 py-4 text-center text-slate-900 shadow-glow">
            <div className="text-3xl font-bold text-emerald-600">{solutionMedia.economyBadge.label}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {solutionMedia.economyBadge.caption}
            </div>
          </div>
          <div className="floating absolute -bottom-8 left-6 rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-700 shadow-2xl">
            <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FontAwesomeIcon icon={faCheck} className="text-sm" />
            </span>
            {solutionMedia.automationBadge.label}
          </div>
        </div>
      </div>
    </section>
  );
}
