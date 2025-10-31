import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { heroHighlights, heroStats } from "../lib/content";
import { staggerDelay } from "../lib/utils";

export function HeroSection() {
  return (
    <section id="hero" className="section-anchor relative overflow-hidden pt-24">
      <div className="hero-backdrop">
        <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 pb-20 pt-16 lg:grid lg:grid-cols-2 lg:items-center">
          <div className="space-y-10 text-white">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-5 py-1.5 text-sm font-semibold uppercase tracking-widest text-blue-100">
                {heroHighlights.label}
              </div>
              <h1
                className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl"
                dangerouslySetInnerHTML={{ __html: heroHighlights.title }}
              />
              <p className="max-w-xl text-lg text-blue-100/90 lg:text-xl">{heroHighlights.description}</p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={heroHighlights.primaryCta.href}
                className="shine inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-glow transition-transform duration-300 hover:-translate-y-1 hover:bg-blue-50"
              >
                {heroHighlights.primaryCta.label}
              </Link>
              <Link
                href={heroHighlights.secondaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl border-2 border-white/60 px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/10"
              >
                {heroHighlights.secondaryCta.label}
              </Link>
            </div>

            <div className="flex flex-wrap gap-8 pt-4">
              {heroStats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="relative rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-center opacity-0 shadow-glass backdrop-blur animate-fade-in-up"
                  style={{ animationDelay: staggerDelay(index) }}
                >
                  <div className="text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs uppercase tracking-wide text-blue-100">{stat.label}</div>
                  <span className="absolute inset-0 rounded-2xl border border-white/5" />
                </div>
              ))}
            </div>
          </div>

          <div className="tilt relative">
            <div className="tilt-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-glow">
              <Image
                src={heroHighlights.image.src}
                alt={heroHighlights.image.alt}
                width={720}
                height={540}
                className="h-full w-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-transparent to-cyan-500/20" />
            </div>
            <div className="floating absolute -bottom-8 -left-6 w-max rounded-2xl border border-white/10 bg-white text-slate-900 shadow-2xl">
              <div className="flex items-center space-x-4 px-6 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <FontAwesomeIcon icon={heroHighlights.spotlight.icon} className="text-lg" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{heroHighlights.spotlight.headline}</div>
                  <div className="text-xs text-slate-500">{heroHighlights.spotlight.subheadline}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
