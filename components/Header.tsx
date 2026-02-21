"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faXmark } from "@fortawesome/free-solid-svg-icons";
import { navLinks } from "../lib/content";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      id="header"
      className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-2xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="#hero" className="flex items-center space-x-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-glow">
            <Image src="/logo.png" alt="Cotar & Construir" width={44} height={44} priority />
          </span>
          <span className="text-2xl font-bold text-white">Cotar &amp; Construir</span>
        </Link>

        <nav className="hidden items-center space-x-8 text-sm font-medium text-slate-200 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative transition-colors duration-300 hover:text-white"
            >
              {link.label}
              <span className="absolute bottom-0 left-0 h-0.5 w-full scale-x-0 bg-gradient-to-r from-blue-500 to-cyan-400 transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <Link
            href="#contato"
            className="hidden rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-transform duration-300 hover:-translate-y-1 hover:bg-blue-500 md:inline-flex"
          >
            Começar Agora
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:text-blue-200"
          >
            Entrar
          </Link>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white transition hover:border-blue-400 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Alternar navegação"
          >
            <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden">
          <div className="space-y-4 border-t border-white/10 bg-slate-950/95 px-6 py-6">
            {navLinks.map((link) => (
              <Link
                key={`mobile-${link.href}`}
                href={link.href}
                className="block rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-500 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="#contato"
              className="block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-glow"
              onClick={() => setMobileOpen(false)}
            >
              Começar Agora
            </Link>
            <Link
              href="/login"
              className="block rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white border border-white/10 hover:border-blue-500"
              onClick={() => setMobileOpen(false)}
            >
              Entrar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
