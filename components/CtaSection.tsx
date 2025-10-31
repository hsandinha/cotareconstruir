import Link from "next/link";
import { ctaContent } from "../lib/content";

export function CtaSection() {
  return (
    <section id="cta" className="section-anchor relative bg-hero-gradient py-24 text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-4xl font-bold md:text-5xl">{ctaContent.title}</h2>
        <p className="mt-6 text-lg text-blue-100">{ctaContent.description}</p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href={ctaContent.primaryButton.href}
            className="shine inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg shadow-blue-900/40 transition-transform duration-300 hover:-translate-y-1"
          >
            {ctaContent.primaryButton.label}
          </Link>
          <Link
            href={ctaContent.secondaryButton.href}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-white/75 px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:border-white"
          >
            {ctaContent.secondaryButton.label}
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 text-center text-blue-100 md:grid-cols-3">
          {ctaContent.highlights.map((feature) => (
            <div key={feature.title}>
              <div className="text-3xl font-bold">{feature.title}</div>
              <div className="text-xs uppercase tracking-wide text-blue-200">{feature.subtitle}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
