import Image from "next/image";
import { benefitMedia, benefitPillars } from "../lib/content";
import { staggerDelay } from "../lib/utils";

export function BenefitsSection() {
  return (
    <section id="beneficios" className="section-anchor relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-purple-200">
              4.0 Benefícios
            </span>
            <h2 className="text-4xl font-bold text-white md:text-5xl">
              Os pilares de valor da nossa solução
            </h2>
            <p className="text-lg text-slate-300">
              Geração de valor sistêmico que se manifesta em pilares interdependentes de performance.
            </p>

            <div className="space-y-6">
              {benefitPillars.map((benefit, index) => (
                <div
                  key={benefit.id}
                  className={`glass-card relative border-l-4 ${benefit.borderClass} p-6 opacity-0 animate-fade-in-up`}
                  style={{ animationDelay: staggerDelay(index, 0.15) }}
                >
                  <h3 className="text-2xl font-semibold text-white">{benefit.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">{benefit.description}</p>
                  <div className="mt-4 flex items-center space-x-3">
                    <span className={`text-3xl font-bold ${benefit.accentClass}`}>
                      {benefit.metricValue}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {benefit.metricLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tilt relative">
            <div className="tilt-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-glow">
              <Image
                src={benefitMedia.image.src}
                alt={benefitMedia.image.alt}
                width={720}
                height={520}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-transparent to-cyan-500/20" />
            </div>
            <div className="floating absolute -top-6 -right-6 w-max rounded-2xl border border-white/10 bg-white px-6 py-5 text-center text-slate-900 shadow-2xl">
              <div className="text-3xl font-bold text-blue-600">{benefitMedia.experienceBadge.label}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {benefitMedia.experienceBadge.caption}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
