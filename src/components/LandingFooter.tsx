import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUp, Dumbbell, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Edit these any time                                                 */
/* ------------------------------------------------------------------ */

const POWERED_BY = { name: "Syteos Labs LLP", url: "https://syteoslabs.com" };

const CONTACT = {
  email: "hello@syteos.com",
  phone: "+91 9764767007",
  phoneHref: "tel:+919764767007",
  address: ["Office No. 201, Xion Mall,", "Pune, Maharashtra, India"],
};

// Paste your profile links here. An icon only shows when its link is filled in.
const SOCIAL_LINKS = {
  instagram: "",
  linkedin: "",
  x: "",
};

/* ------------------------------------------------------------------ */

const PRODUCT = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Live Demo" },
  { href: "#roi", label: "Renewal Calculator" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Brand icons are drawn here so they never depend on the icon library version
const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const InstagramIcon = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </Svg>
);

const LinkedinIcon = () => (
  <Svg>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </Svg>
);

const XIcon = () => (
  <Svg>
    <path d="M4 4l16 16M20 4L4 20" />
  </Svg>
);

const SOCIALS = [
  { label: "Instagram", href: SOCIAL_LINKS.instagram, icon: <InstagramIcon /> },
  { label: "LinkedIn", href: SOCIAL_LINKS.linkedin, icon: <LinkedinIcon /> },
  { label: "X (Twitter)", href: SOCIAL_LINKS.x, icon: <XIcon /> },
].filter((s) => s.href);

const colTitle = "text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-light";
const linkCls =
  "group inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white";

const Arrow = () => (
  <ArrowRight
    size={13}
    className="-translate-x-1 text-gold-light opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
  />
);

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] text-white">
      {/* glow and top line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-gold/15 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-gold-light/10 blur-[110px]" />

      <div className="relative mx-auto max-w-7xl px-6 pt-12">
        {/* CTA strip */}
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-gold/25 bg-white/[0.04] p-8 backdrop-blur sm:p-10">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-gold-light">Get started today</p>
            <h3 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              Ready to run your gym like a{" "}
              <span className="italic text-gold-light">flagship?</span>
            </h3>
            <p className="mt-3 text-sm text-white/55">
              Create your account in minutes. Our team reviews it and activates it for you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup" className="btn-gold flex items-center gap-2 px-7 py-3.5 text-sm">
              Create your account <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-white/25 px-7 py-3.5 text-sm font-medium transition hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* columns */}
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          {/* brand */}
          <div>
            <a href="#top" className="inline-flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-gold-light to-gold text-charcoal shadow-lg shadow-gold/30">
                <Dumbbell size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="font-display text-xl font-semibold tracking-wide text-gold-light">GYMOS</p>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Gym Management Platform
                </p>
              </div>
            </a>

            <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/55">
              Members, memberships, billing, attendance, classes and reports in one beautifully
              crafted platform, made for gym owners who want to grow.
            </p>

            {SOCIALS.length > 0 && (
              <div className="mt-6 flex gap-3">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition hover:-translate-y-0.5 hover:border-gold/60 hover:bg-gold/15 hover:text-gold-light"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* product */}
          <div>
            <p className={colTitle}>Product</p>
            <ul className="mt-6 space-y-3.5">
              {PRODUCT.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={linkCls}>
                    {l.label} <Arrow />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* account */}
          <div>
            <p className={colTitle}>Account</p>
            <ul className="mt-6 space-y-3.5">
              <li>
                <Link to="/login" className={linkCls}>
                  Sign in <Arrow />
                </Link>
              </li>
              <li>
                <Link to="/signup" className={linkCls}>
                  Create account <Arrow />
                </Link>
              </li>
              <li>
                <a href="#pricing" className={linkCls}>
                  Choose a plan <Arrow />
                </a>
              </li>
            </ul>
          </div>

          {/* contact */}
          <div>
            <p className={colTitle}>Get in touch</p>
            <ul className="mt-6 space-y-5 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gold-light">
                  <MapPin size={16} />
                </span>
                <span className="leading-relaxed text-white/60">
                  {CONTACT.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </li>
              <li>
                <a href={CONTACT.phoneHref} className="group flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gold-light transition group-hover:border-gold/50">
                    <Phone size={16} />
                  </span>
                  <span className="text-white/60 transition group-hover:text-white">
                    {CONTACT.phone}
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className="group flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gold-light transition group-hover:border-gold/50">
                    <Mail size={16} />
                  </span>
                  <span className="break-all text-white/60 transition group-hover:text-white">
                    {CONTACT.email}
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* big faded wordmark (delete this whole block for an even tighter footer) */}
        <div className="relative mt-6 h-[6vw] min-h-[40px] overflow-hidden" aria-hidden>
          <p className="pointer-events-none select-none text-center font-display text-[22vw] font-semibold leading-[0.8] tracking-wider text-white/[0.04]">
            GYMOS
          </p>
        </div>
      </div>

      {/* bottom bar: pb-24 keeps it clear of the floating "Start your gym" button */}
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 pb-24 pt-5">
          <p className="text-xs text-white/45">
            © {year} GYMOS Platform. All rights reserved.
          </p>

          <a
            href={POWERED_BY.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/85 transition hover:border-gold/60 hover:bg-gold/10 hover:text-white"
          >
            Powered by
            <span className="font-semibold text-gold-light">{POWERED_BY.name}</span>
            <ExternalLink
              size={12}
              className="text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold-light"
            />
          </a>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex items-center gap-2 text-xs text-white/55 transition hover:text-white"
          >
            Back to top
            <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 transition group-hover:border-gold/60 group-hover:bg-gold/15">
              <ArrowUp size={14} />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
