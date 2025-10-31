import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { challenges } from "../lib/content";
import { staggerDelay } from "../lib/utils";

export function ChallengesSection() {
  return (
    <section id="problema" className="section-anchor relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold text-white md:text-5xl">
            O Desafio Crítico na Construção Civil
          </h2>
          <p className="mt-6 text-lg text-slate-300">
            A gestão de suprimentos representa a maior vulnerabilidade sistêmica e o vetor central de
            erosão de margem no setor — impactando cronogramas, custos e reputação.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {challenges.map((challenge, index) => (
            <div
              key={challenge.id}
              className="glass-card tilt-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 opacity-0 transition-all animate-fade-in-up"
              style={{ animationDelay: staggerDelay(index, 0.12) }}
            >
              <span
                className={`${challenge.accentClass} mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl`}
              >
                <FontAwesomeIcon icon={challenge.icon} className={`text-2xl ${challenge.colorClass}`} />
              </span>
              <h3 className="text-xl font-semibold text-white">{challenge.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">{challenge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
