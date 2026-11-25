import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as RMouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Calculator,
  CalendarDays,
  Check,
  CreditCard,
  Dumbbell,
  Flame,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  QrCode,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { db } from "../firebase";
import type { Plan } from "../types";
import LandingFooter from "../components/LandingFooter";

/* ------------------------------------------------------------------ */
/* MEDIA: change these any time.                                       */
/* Photos come from Unsplash. If one fails to load, a gold placeholder */
/* appears automatically. Video: put your file at public/videos/gym.mp4*/
/* ------------------------------------------------------------------ */

const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const IMG = {
  hero: u("photo-1534438327276-14e5300c3a48", 1000),
  heroB: u("photo-1571019613454-1cb2f99b2d8b", 700),
  heroC: u("photo-1517836357463-d25dfeac3438", 600),
  interior: u("photo-1558611848-73f7eb4001a1", 1600),
  cardio: u("photo-1540497077202-7c8a3999166f", 800),
  yoga: u("photo-1544367567-0f2fcb009e0b", 800),
  boxing: u("photo-1549719386-74dfcbf7dbed", 800),
  crossfit: u("photo-1526506118085-60ce8714f8c5", 800),
  spin: u("photo-1534258936925-c58bed479fcb", 800),
  trainer: u("photo-1581009146145-b5ef050c2e1e", 900),
};

const VIDEO_SRC = "/videos/gym.mp4";
const SLIDES = [IMG.interior, IMG.hero, IMG.crossfit, IMG.cardio];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function Img({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-gold-light/70 via-[#f3e6c0] to-gold/40 text-gold-soft ${className}`}
      >
        <Dumbbell size={40} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBad(true)}
      className={`object-cover ${className}`}
    />
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        show ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1600);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, to]);

  return (
    <span ref={ref}>
      {n.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

// Smoothly animates a number whenever its target changes
function useTween(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const cur = a + (target - a) * (1 - Math.pow(1 - p, 3));
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.35em] text-gold-soft">{children}</p>;
}

// Headline that slides up word by word
function Words({
  text,
  delay = 0,
  textClass = "",
}: {
  text: string;
  delay?: number;
  textClass?: string;
}) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.14em] pr-[0.04em] align-bottom">
          <span className="lp-word inline-block" style={{ animationDelay: `${delay + i * 110}ms` }}>
            <span className={textClass}>{w}</span>
            {"\u00A0"}
          </span>
        </span>
      ))}
    </>
  );
}

// Button that leans toward the cursor
function Magnetic({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: RMouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x * 0.2}px, ${y * 0.3}px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <span
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={`inline-block transition-transform duration-200 ease-out ${className}`}
    >
      {children}
    </span>
  );
}

// 3D tilt with a soft glare that follows the cursor
function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: RMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${
      (px - 0.5) * max
    }deg) translateY(-4px)`;
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={`lp-tilt relative transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {children}
      <span className="lp-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}

const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const limit = (n: number) => (n === 0 ? "Unlimited" : n.toLocaleString("en-IN"));

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Live Demo" },
  { href: "#roi", label: "ROI" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const SHOWCASE = [
  {
    icon: QrCode,
    title: "QR Check-in & Access",
    text: "Scan the member card. Expired or frozen plans are stopped with a clear reason, and your desk can allow entry with a note.",
    img: IMG.cardio,
  },
  {
    icon: CalendarDays,
    title: "Classes & Waitlists",
    text: "Weekly schedules, seat limits and automatic waitlist promotion. Yoga, HIIT, Zumba, whatever you run.",
    img: IMG.yoga,
  },
  {
    icon: Dumbbell,
    title: "Personal Training",
    text: "Sell session packs, book one-to-one sessions with clash checks and track every session delivered.",
    img: IMG.trainer,
  },
];

const FEATURES = [
  { icon: Users, title: "Members & Memberships", text: "Register, sell, renew, upgrade and freeze with automatic end dates." },
  { icon: CreditCard, title: "Billing & Receipts", text: "Collect dues, issue refunds and print GST-ready receipts." },
  { icon: Target, title: "Leads & Sales", text: "Log follow-ups and turn an enquiry into a member in one click." },
  { icon: Package, title: "Inventory & Equipment", text: "Stock, sales, suppliers and machine service reminders." },
  { icon: MessageCircle, title: "WhatsApp & SMS CRM", text: "Renewal, due and birthday messages from ready templates." },
  { icon: BarChart3, title: "Reports & Analytics", text: "Revenue, renewals, footfall and conversion, exportable to CSV." },
  { icon: ShieldCheck, title: "Roles & Permissions", text: "Staff see only the pages and actions you tick for them." },
  { icon: GitBranch, title: "Multi-Branch Control", text: "One login, every location, one branch switcher." },
  { icon: Bell, title: "Always Live", text: "A check-in at the desk updates your dashboard instantly." },
];

const FLOORS = [
  { label: "Strength Zone", img: IMG.hero },
  { label: "Cardio Deck", img: IMG.cardio },
  { label: "Yoga Studio", img: IMG.yoga },
  { label: "Boxing Ring", img: IMG.boxing },
  { label: "CrossFit Box", img: IMG.crossfit },
  { label: "Spin Room", img: IMG.spin },
];

const STEPS = [
  { n: "01", title: "Create your gym", text: "Sign up, pick a plan and tell us about your business. We review and activate it." },
  { n: "02", title: "Set up in minutes", text: "Add branches, starter membership plans in one click, and your team's logins." },
  { n: "03", title: "Run it like a flagship", text: "Register, bill, check in and follow up from one beautiful dashboard." },
];

const TESTIMONIALS = [
  {
    quote: "Renewals used to live in a notebook. Now the expiring list is on my screen every morning and I message members in one tap.",
    name: "Rohit Deshmukh",
    role: "Owner, IronForge Fitness",
  },
  {
    quote: "QR check-in at our desk is smooth, and blocked entries come with a reason. Arguments at the counter are gone.",
    name: "Sneha Kulkarni",
    role: "Manager, PulseFit Studio",
  },
  {
    quote: "Three branches, one login. I finally see revenue by branch without asking anyone for a spreadsheet.",
    name: "Imran Shaikh",
    role: "Founder, Apex Gyms",
  },
];

const FAQ = [
  { q: "How long does setup take?", a: "Most gyms are running the same day. Create your account, add a branch, create starter plans in one click and register your first member." },
  { q: "Can my trainers and front desk have their own logins?", a: "Yes. Every staff member gets a login and you tick exactly which pages and actions they can use. Salary and private notes stay visible to the owner only." },
  { q: "Does it handle GST on receipts?", a: "Yes. Add your GSTIN and rate once and receipts show the CGST and SGST breakup, treating plan prices as GST-inclusive." },
  { q: "Can I manage more than one branch?", a: "Absolutely. Members, classes and reports follow a branch switcher in the top bar, and you can always view all branches together." },
  { q: "What if I need a bigger plan later?", a: "Contact the platform team and your plan is upgraded. Your data stays exactly where it is." },
];

type PlanCard = {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxMembers: number;
  features: string[];
  popular: boolean;
};

const FALLBACK_PLANS: PlanCard[] = [
  { id: "starter", name: "Starter", priceMonthly: 999, priceYearly: 9990, maxBranches: 1, maxMembers: 200, popular: false, features: ["Member management", "Attendance tracking", "Basic reports", "Email support"] },
  { id: "business", name: "Business", priceMonthly: 2499, priceYearly: 24990, maxBranches: 3, maxMembers: 1000, popular: true, features: ["Everything in Starter", "Class booking & scheduling", "Trainer management", "WhatsApp & SMS reminders", "Billing & invoices"] },
  { id: "premium", name: "Premium", priceMonthly: 4999, priceYearly: 49990, maxBranches: 0, maxMembers: 0, popular: false, features: ["Everything in Business", "Unlimited branches & members", "Advanced analytics", "Member mobile app", "Priority support"] },
];

const BARS = [38, 52, 44, 66, 58, 80, 72, 92, 84, 100];

const EVENTS = [
  { icon: QrCode, title: "Aarav checked in", sub: "Annual · valid till 14 Dec" },
  { icon: CreditCard, title: "₹2,500 received", sub: "UPI · INV-00142" },
  { icon: BadgeCheck, title: "Neha renewed", sub: "Quarterly plan" },
  { icon: MessageCircle, title: "Reminder sent", sub: "12 expiring members" },
  { icon: Target, title: "New lead added", sub: "Walk-in · Weight loss" },
];

/* ------------------------------------------------------------------ */
/* Hero collage                                                        */
/* ------------------------------------------------------------------ */

// Moves with the mouse. depth > 0 moves with it, depth < 0 against it.
function Layer({
  depth,
  className,
  children,
}: {
  depth: number;
  className: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)`,
    transition: "transform .35s ease-out",
  };
  return (
    <div className={`absolute ${className}`} style={style}>
      {children}
    </div>
  );
}

function ActivityCard() {
  const [tick, setTick] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2800);
    return () => clearInterval(t);
  }, []);
  const n = EVENTS.length;

  return (
    <div className="w-64 rounded-2xl border border-gold/30 bg-white/90 p-4 shadow-xl shadow-gold/20 backdrop-blur">
      <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold-soft">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live activity
      </p>
      <div className="space-y-3">
        {[0, 1, 2].map((k) => {
          const ev = EVENTS[(((tick - k) % n) + n) % n];
          const Icon = ev.icon;
          return (
            <div
              key={tick - k}
              className={`flex items-center gap-3 ${k === 0 ? "lp-pop" : ""}`}
              style={{ opacity: 1 - k * 0.32 }}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-light to-gold text-charcoal">
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{ev.title}</p>
                <p className="truncate text-xs text-muted">{ev.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroCollage() {
  return (
    <div className="relative mx-auto h-[580px] w-full max-w-[560px]">
      <div className="lp-blob absolute -right-6 top-6 h-72 w-72 rounded-full bg-gold/30 blur-3xl" />
      <div className="lp-blob absolute bottom-0 left-0 h-60 w-60 rounded-full bg-gold-light/50 blur-3xl" />

      <Layer depth={-16} className="right-0 top-0">
        <div className="lp-float-slow relative h-[470px] w-[300px] overflow-hidden rounded-t-[150px] rounded-b-[2rem] border-[6px] border-white shadow-[0_30px_70px_-20px_rgba(120,90,20,0.5)]">
          <Img src={IMG.hero} alt="Strength training" className="lp-kenburns h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent" />
        </div>
      </Layer>

      <Layer depth={22} className="bottom-6 left-0">
        <div className="lp-float h-[230px] w-[230px] overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[0_30px_70px_-20px_rgba(120,90,20,0.45)]">
          <Img src={IMG.heroB} alt="Member training" className="h-full w-full" />
        </div>
      </Layer>

      <Layer depth={32} className="left-8 top-8">
        <div className="lp-float-slow h-28 w-28 overflow-hidden rounded-full border-[5px] border-white shadow-xl shadow-gold/30">
          <Img src={IMG.heroC} alt="Workout" className="h-full w-full" />
        </div>
      </Layer>

      <Layer depth={42} className="left-[-10px] top-[190px] z-10">
        <div className="lp-float">
          <ActivityCard />
        </div>
      </Layer>

      <Layer depth={26} className="bottom-0 right-2 z-10">
        <div className="lp-float-slow w-60 rounded-2xl border border-gold/30 bg-white/95 p-4 shadow-xl shadow-gold/20 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold-soft">
              <TrendingUp size={13} /> Revenue
            </p>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700">
              +18%
            </span>
          </div>
          <p className="mt-1 font-display text-2xl font-semibold">₹6.4 L</p>
          <svg viewBox="0 0 120 40" className="mt-1 h-10 w-full">
            <path
              d="M0 32 L15 26 L30 29 L45 18 L60 22 L75 10 L90 14 L120 3"
              fill="none"
              stroke="#c9a227"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="lp-draw"
            />
          </svg>
        </div>
      </Layer>

      <Layer depth={36} className="right-[-8px] top-[310px] z-10">
        <div className="lp-float flex items-center gap-2 rounded-full border border-gold/30 bg-charcoal px-4 py-2.5 text-white shadow-xl shadow-black/30">
          <HeartPulse size={16} className="lp-beat text-gold-light" />
          <span className="text-xs">42 inside right now</span>
        </div>
      </Layer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cinematic video (falls back to a moving photo slideshow)            */
/* ------------------------------------------------------------------ */

function Cinematic() {
  const [failed, setFailed] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!failed) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [failed]);

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[2rem] border-[6px] border-white bg-gradient-to-br from-[#f3e6c0] to-gold/50 shadow-[0_40px_100px_-30px_rgba(120,90,20,0.55)] sm:aspect-[21/9]">
      {!failed && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        >
          <source src={VIDEO_SRC} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}

      {failed &&
        SLIDES.map((s, i) => (
          <div
            key={s}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
          >
            <Img src={s} alt="Gym" className="lp-kenburns h-full w-full" />
          </div>
        ))}

      <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/35 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-14">
        <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs text-white backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
          </span>
          Live from the gym floor
        </div>
        <h3 className="max-w-md font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
          The energy of your gym,
          <span className="lp-shine-text italic"> under control.</span>
        </h3>
        <div className="mt-6 flex flex-wrap gap-3">
          {["Members in", "Revenue today", "Classes full"].map((c, i) => (
            <span
              key={c}
              className="lp-float rounded-full border border-white/25 bg-white/15 px-4 py-2 text-xs text-white backdrop-blur"
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive product demo                                            */
/* ------------------------------------------------------------------ */

function DemoDashboard() {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">IronForge Fitness</p>
      <p className="mt-1 font-display text-2xl font-semibold">
        Good evening, <span className="gold-text">Rohit</span>
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["842", "Active Members"],
          ["37", "Expiring in 7 Days"],
          ["₹6.4 L", "Revenue This Month"],
          ["58", "New This Month"],
        ].map(([v, k], i) => (
          <div
            key={k}
            className={`rounded-xl p-4 ${
              i === 0
                ? "border border-gold/40 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] text-white"
                : "border border-line bg-white"
            }`}
          >
            <p className={`font-display text-xl font-semibold ${i === 0 ? "text-gold-light" : ""}`}>{v}</p>
            <p className={`mt-1 text-[11px] ${i === 0 ? "text-white/60" : "text-muted"}`}>{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-white p-4 lg:col-span-3">
          <p className="text-xs text-muted">Monthly collections</p>
          <div className="mt-4 flex h-32 items-end gap-2">
            {BARS.map((h, i) => (
              <div
                key={i}
                className="lp-bar flex-1 rounded-t-md bg-gradient-to-t from-gold to-gold-light"
                style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 lg:col-span-2">
          <p className="text-xs text-muted">Expiring soon</p>
          <div className="mt-3 space-y-3">
            {[
              ["Neha Joshi", "2 days"],
              ["Kunal Mehta", "4 days"],
              ["Pooja Rane", "6 days"],
            ].map(([n, d]) => (
              <div key={n} className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-xs font-semibold text-charcoal">
                  {n[0]}
                </div>
                <p className="flex-1 text-sm">{n}</p>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoCheckin() {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">Check-in Desk</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-gold/40 bg-white px-4 py-3.5 shadow-sm">
        <Search size={17} className="text-muted" />
        <span className="lp-type font-medium">M-0142</span>
        <span className="lp-caret h-5 w-px bg-charcoal" />
      </div>

      <div className="lp-pop mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4" style={{ animationDelay: "1.3s" }}>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">A</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Aarav Patil <span className="text-xs text-muted">· M-0142</span></p>
          <p className="text-xs text-muted">Annual · until 14 Dec 2026</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700">Active</span>
        <span className="btn-gold px-4 py-2 text-xs">Check in</span>
      </div>

      <div className="lp-pop mt-3 rounded-xl border border-red-300 bg-red-500/5 p-4" style={{ animationDelay: "2s" }}>
        <p className="flex items-center gap-2 text-sm font-medium text-red-700">
          <ShieldCheck size={16} /> Entry blocked: Karan Shah
        </p>
        <p className="mt-1 text-xs text-muted">The membership expired on 18 Oct 2026. You can allow entry with a reason, and it is saved in the visit record.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-line bg-white px-3 py-2 text-muted">Renewal payment coming today</span>
          <span className="btn-gold px-4 py-2">Allow entry anyway</span>
        </div>
      </div>
    </div>
  );
}

function DemoBilling() {
  const rows = [
    ["INV-00142", "Aarav Patil", "UPI", "₹12,000", "Paid", "bg-emerald-500/10 text-emerald-700"],
    ["INV-00141", "Neha Joshi", "Cash", "₹4,000", "Paid", "bg-emerald-500/10 text-emerald-700"],
    ["INV-00140", "Kunal Mehta", "Card", "₹7,000", "Partly refunded", "bg-amber-500/10 text-amber-700"],
    ["INV-00139", "Pooja Rane", "UPI", "₹1,500", "Paid", "bg-emerald-500/10 text-emerald-700"],
  ];
  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">Billing & Payments</p>
          <p className="mt-1 font-display text-2xl font-semibold">₹6,41,500 <span className="text-sm font-normal text-muted">collected this month</span></p>
        </div>
        <div className="lp-pop flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5">
          <div>
            <p className="text-[11px] text-muted">Outstanding dues</p>
            <p className="font-display text-lg font-semibold text-red-600">₹18,400</p>
          </div>
          <span className="rounded-lg bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold-soft">Collect</span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        {rows.map(([inv, who, how, amt, st, cls], i) => (
          <div
            key={inv}
            className="lp-pop flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line/70 px-4 py-3 text-sm last:border-0"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <span className="w-24 font-medium">{inv}</span>
            <span className="min-w-[110px] flex-1">{who}</span>
            <span className="w-14 text-muted">{how}</span>
            <span className="w-20 font-medium">{amt}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{st}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoReports() {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">Reports & Analytics</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-white p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted">Collections, last 6 months</p>
            <p className="text-xs text-emerald-700">+18% vs previous</p>
          </div>
          <svg viewBox="0 0 300 120" className="mt-3 h-40 w-full">
            <defs>
              <linearGradient id="lpArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a227" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 100 L50 84 L100 90 L150 58 L200 66 L250 30 L300 18 L300 120 L0 120 Z" fill="url(#lpArea)" />
            <path
              d="M0 100 L50 84 L100 90 L150 58 L200 66 L250 30 L300 18"
              fill="none"
              stroke="#b8902c"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="lp-draw-once"
            />
          </svg>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 lg:col-span-2">
          <p className="text-xs text-muted">Where new members come from</p>
          <div className="mt-4 space-y-4">
            {[
              ["Walk-in", 82],
              ["Referral", 61],
              ["Social media", 40],
              ["Website", 24],
            ].map(([k, v], i) => (
              <div key={k}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted">{v}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gold/10">
                  <div
                    className="lp-growx h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                    style={{ width: `${v}%`, animationDelay: `${i * 120}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, blurb: "Live KPIs and renewals at a glance", view: <DemoDashboard /> },
  { key: "checkin", label: "Check-in Desk", icon: QrCode, blurb: "Validate memberships in one scan", view: <DemoCheckin /> },
  { key: "billing", label: "Billing", icon: CreditCard, blurb: "Payments, dues, refunds, receipts", view: <DemoBilling /> },
  { key: "reports", label: "Reports", icon: BarChart3, blurb: "Revenue, renewals and lead sources", view: <DemoReports /> },
];

function ProductDemo() {
  const [active, setActive] = useState(0);
  const next = () => setActive((i) => (i + 1) % DEMO_TABS.length);

  return (
    <div className="lp-demo grid items-start gap-8 lg:grid-cols-[300px_1fr]">
      <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {DEMO_TABS.map((t, i) => {
          const on = i === active;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(i)}
              className={`relative min-w-[220px] overflow-hidden rounded-2xl border p-5 text-left transition lg:min-w-0 ${
                on
                  ? "border-gold/50 bg-white shadow-xl shadow-gold/20"
                  : "border-line bg-white/50 hover:border-gold/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                    on
                      ? "bg-gradient-to-br from-gold-light to-gold text-charcoal"
                      : "bg-gold/10 text-gold-soft"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-display text-base font-semibold">{t.label}</p>
                  <p className="text-xs text-muted">{t.blurb}</p>
                </div>
              </div>
              {on && (
                <span
                  key={active}
                  onAnimationEnd={next}
                  className="lp-progress absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-gold-light to-gold"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <div className="absolute -inset-4 rounded-[2.5rem] bg-gold/20 blur-3xl" />
        <div className="relative overflow-hidden rounded-3xl border-[6px] border-white bg-gradient-to-br from-[#fffdf8] to-[#f8f1df] shadow-[0_40px_100px_-30px_rgba(120,90,20,0.55)]">
          <div className="flex items-center gap-2 border-b border-line bg-white/80 px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-4 rounded-md bg-gold/10 px-3 py-1 text-[11px] text-muted">
              gymos.app / {DEMO_TABS[active].key}
            </span>
          </div>
          <div key={active} className="lp-fadein min-h-[390px]">
            {DEMO_TABS[active].view}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Before / after slider                                               */
/* ------------------------------------------------------------------ */

function Compare() {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative h-[430px] w-full select-none overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[0_40px_100px_-30px_rgba(120,90,20,0.55)]">
      {/* GYMOS side (below) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fffdf8] to-[#f3e6c0] p-6 sm:p-10">
        <p className="ml-auto w-fit rounded-full bg-charcoal px-4 py-1.5 text-xs tracking-widest text-gold-light">
          WITH GYMOS
        </p>
        <div className="ml-auto mt-6 max-w-md space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["842", "Active"],
              ["37", "Expiring"],
              ["₹18.4k", "Dues"],
            ].map(([v, k]) => (
              <div key={k} className="rounded-xl border border-line bg-white p-3 text-center">
                <p className="font-display text-xl font-semibold">{v}</p>
                <p className="text-[11px] text-muted">{k}</p>
              </div>
            ))}
          </div>
          {[
            ["Aarav · Annual", "Valid", "bg-emerald-500/10 text-emerald-700"],
            ["Neha · 3 days left", "Reminder sent", "bg-amber-500/10 text-amber-700"],
            ["Rahul · ₹0 due", "Paid", "bg-emerald-500/10 text-emerald-700"],
          ].map(([a, b, cls]) => (
            <div key={a} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <span>{a}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Old way side (above, clipped) */}
      <div
        className="absolute inset-0 p-6 sm:p-10"
        style={{
          clipPath: `inset(0 ${100 - pos}% 0 0)`,
          background:
            "repeating-linear-gradient(#f6edcf, #f6edcf 31px, rgba(80,120,200,.28) 32px)",
          fontFamily: "'Segoe Print','Comic Sans MS',cursive",
        }}
      >
        <p className="w-fit rounded-full bg-red-600 px-4 py-1.5 text-xs tracking-widest text-white" style={{ fontFamily: "inherit" }}>
          THE OLD WAY
        </p>
        <div className="mt-6 max-w-md space-y-3 text-[15px] text-slate-700">
          <p>Renewals: who is expiring?? 😵</p>
          <p className="line-through decoration-red-500">Rahul ₹1500 (paid? check)</p>
          <p>Pooja — expired 12th ???</p>
          <p>Balance pending: ??? ask Amit</p>
          <p className="line-through decoration-red-500">Locker 14, who has the key</p>
        </div>
        <div className="absolute bottom-8 right-8 hidden w-44 rotate-6 rounded-sm bg-yellow-200 p-4 text-sm text-slate-700 shadow-lg sm:block">
          Call Amit!!
          <br />
          (3 days ago)
        </div>
        <div className="absolute bottom-24 left-1/2 hidden -translate-x-1/2 -rotate-6 rounded-full border-2 border-red-500 px-4 py-1 text-sm text-red-600 sm:block">
          ₹ mismatch!
        </div>
      </div>

      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,.35)]" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-gold-light to-gold text-charcoal shadow-xl">
          <span className="text-lg font-bold leading-none">⇆</span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare the old way with GYMOS"
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ROI calculator                                                      */
/* ------------------------------------------------------------------ */

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="rounded-full bg-gold/15 px-3 py-1 text-sm font-semibold text-gold-soft">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer accent-[#c9a227]"
      />
    </div>
  );
}

function Roi() {
  const [members, setMembers] = useState(400);
  const [fee, setFee] = useState(1500);
  const [lapse, setLapse] = useState(12);
  const [win, setWin] = useState(20);

  const lapsed = (members * lapse) / 100;
  const wonBack = (lapsed * win) / 100;
  const perMonth = wonBack * fee;

  const tMonth = useTween(perMonth);
  const tYear = useTween(perMonth * 12);
  const tWon = useTween(wonBack);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="card space-y-8 p-8">
        <Slider label="Active members" value={members} min={50} max={2000} step={10} format={(n) => n.toLocaleString("en-IN")} onChange={setMembers} />
        <Slider label="Average monthly fee" value={fee} min={500} max={5000} step={100} format={rupee} onChange={setFee} />
        <Slider label="Members whose plan lapses each month" value={lapse} min={3} max={30} step={1} format={(n) => `${n}%`} onChange={setLapse} />
        <Slider label="Share you win back with timely reminders" value={win} min={5} max={40} step={1} format={(n) => `${n}%`} onChange={setWin} />
        <p className="text-xs leading-relaxed text-muted">
          This is an illustration based only on the numbers you choose above. It is not a
          guarantee of results.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] p-9 text-white shadow-2xl shadow-black/30">
        <div className="lp-blob absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gold/25 blur-3xl" />
        <p className="relative text-xs uppercase tracking-[0.3em] text-gold-light">You could win back</p>
        <p className="relative mt-3 font-display text-5xl font-semibold text-gold-light sm:text-6xl">
          {rupee(tMonth)}
        </p>
        <p className="relative text-sm text-white/55">every month</p>

        <div className="relative mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-display text-3xl font-semibold">{rupee(tYear)}</p>
            <p className="mt-1 text-xs text-white/50">per year</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-display text-3xl font-semibold">{tWon.toFixed(1)}</p>
            <p className="mt-1 text-xs text-white/50">members back each month</p>
          </div>
        </div>

        <Link to="/signup" className="btn-gold relative mt-8 flex items-center justify-center gap-2 py-3.5 text-sm">
          Start winning them back <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [menu, setMenu] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const [plans, setPlans] = useState<PlanCard[]>(FALLBACK_PLANS);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 20);
      setShowCta(y > 800);
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "plans"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Plan)
          .filter((p) => p.status === "active")
          .sort((a, b) => a.priceMonthly - b.priceMonthly)
          .map((p) => ({
            id: p.id,
            name: p.name,
            priceMonthly: p.priceMonthly,
            priceYearly: p.priceYearly,
            maxBranches: p.maxBranches,
            maxMembers: p.maxMembers,
            features: p.features ?? [],
            popular: !!p.popular,
          }));
        if (list.length > 0) setPlans(list);
      },
      () => {
        /* keep defaults */
      }
    );
  }, []);

  const heroMove = (e: RMouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.setProperty("--px", String((x / r.width - 0.5) * 2));
    el.style.setProperty("--py", String((y / r.height - 0.5) * 2));
  };
  const heroLeave = (e: RMouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--px", "0");
    e.currentTarget.style.setProperty("--py", "0");
  };

  return (
    <div className="overflow-x-hidden bg-page text-charcoal">
      <style>{`
        @property --lp-ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        html { scroll-behavior: smooth; }
        @keyframes lp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes lp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes lp-kb { 0% { transform: scale(1) } 100% { transform: scale(1.12) translate(-1.5%, -1%) } }
        @keyframes lp-shine { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes lp-blob { 0%,100% { transform: scale(1) translate(0,0) } 50% { transform: scale(1.15) translate(14px,-10px) } }
        @keyframes lp-drawk { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        @keyframes lp-beatk { 0%,100% { transform: scale(1) } 20% { transform: scale(1.35) } 40% { transform: scale(1) } 60% { transform: scale(1.25) } }
        @keyframes lp-wordup { from { transform: translateY(115%) } to { transform: translateY(0) } }
        @keyframes lp-popk { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes lp-fadek { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes lp-progk { from { width: 0 } to { width: 100% } }
        @keyframes lp-typek { from { width: 0 } to { width: 6ch } }
        @keyframes lp-blink { 50% { opacity: 0 } }
        @keyframes lp-growk { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes lp-growxk { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes lp-spin { to { --lp-ang: 360deg } }
        .lp-float { animation: lp-float 6s ease-in-out infinite }
        .lp-float-slow { animation: lp-float 8.5s ease-in-out infinite }
        .lp-marquee { animation: lp-marquee 42s linear infinite }
        .lp-marquee:hover { animation-play-state: paused }
        .lp-kenburns { animation: lp-kb 16s ease-in-out infinite alternate }
        .lp-blob { animation: lp-blob 10s ease-in-out infinite }
        .lp-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lp-drawk 2.6s ease-in-out infinite alternate }
        .lp-draw-once { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lp-drawk 1.8s ease-out forwards }
        .lp-beat { animation: lp-beatk 1.4s ease-in-out infinite }
        .lp-word { animation: lp-wordup .9s cubic-bezier(.2,.8,.2,1) both; transform: translateY(115%) }
        .lp-pop { animation: lp-popk .55s cubic-bezier(.2,.8,.2,1) both }
        .lp-fadein { animation: lp-fadek .5s ease both }
        .lp-progress { animation: lp-progk 6s linear forwards }
        .lp-demo:hover .lp-progress { animation-play-state: paused }
        .lp-type { display: inline-block; overflow: hidden; white-space: nowrap; animation: lp-typek 1.1s steps(6) .2s both }
        .lp-caret { animation: lp-blink 1s steps(1) infinite }
        .lp-bar { transform-origin: bottom; animation: lp-growk .9s cubic-bezier(.2,.8,.2,1) both }
        .lp-growx { transform-origin: left; animation: lp-growxk .9s cubic-bezier(.2,.8,.2,1) both }
        .lp-shine-text {
          background: linear-gradient(110deg, #a8812a 20%, #f6dc84 40%, #d9b13d 50%, #a8812a 80%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: lp-shine 6s linear infinite;
        }
        .lp-dots {
          background-image: radial-gradient(rgba(201,162,39,.28) 1.2px, transparent 1.2px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%);
        }
        .lp-glare {
          background: radial-gradient(260px circle at var(--gx, 50%) var(--gy, 50%), rgba(255,236,170,.45), transparent 60%);
          opacity: 0; transition: opacity .25s;
        }
        .lp-tilt:hover .lp-glare { opacity: 1 }
        .lp-border {
          border-radius: 1.6rem; padding: 2px;
          background: conic-gradient(from var(--lp-ang), #c9a227, #fff3c4, #c9a227 35%, #7a5a0c 60%, #c9a227);
          animation: lp-spin 5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-float,.lp-float-slow,.lp-marquee,.lp-kenburns,.lp-blob,.lp-draw,.lp-beat,.lp-shine-text,.lp-border,.lp-caret { animation: none }
          .lp-word { transform: none; animation: none }
        }
      `}</style>

      {/* scroll progress */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px]">
        <div
          ref={barRef}
          className="h-full origin-left bg-gradient-to-r from-gold-light via-gold to-gold-soft"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      {/* ---------------- Navbar ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "border-b border-line bg-white/80 py-3 shadow-sm backdrop-blur-xl" : "bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal text-gold-light shadow-lg shadow-black/20">
              <Dumbbell size={19} strokeWidth={2.2} />
            </div>
            <span className="gold-text font-display text-xl font-semibold tracking-wide">GYMOS</span>
          </a>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-muted transition hover:text-charcoal">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="px-4 py-2 text-sm text-muted transition hover:text-charcoal">
              Sign in
            </Link>
            <Link to="/signup" className="btn-gold px-5 py-2.5 text-sm">
              Get started
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menu && (
          <div className="card mx-4 mt-3 p-5 md:hidden">
            <div className="flex flex-col gap-4">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={() => setMenu(false)}>
                  {n.label}
                </a>
              ))}
              <div className="mt-2 flex gap-3">
                <Link to="/login" className="flex-1 rounded-xl border border-line py-2.5 text-center text-sm">
                  Sign in
                </Link>
                <Link to="/signup" className="btn-gold flex-1 py-2.5 text-center text-sm">
                  Get started
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ---------------- Hero ---------------- */}
      <section
        id="top"
        onMouseMove={heroMove}
        onMouseLeave={heroLeave}
        className="relative isolate overflow-hidden px-6 pb-24 pt-36"
      >
        <div className="lp-dots absolute inset-0 -z-10" />
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(520px circle at var(--mx, 70%) var(--my, 30%), rgba(201,162,39,.2), transparent 60%)",
          }}
        />
        <div className="lp-blob absolute -left-32 top-20 -z-10 h-96 w-96 rounded-full bg-gold-light/40 blur-[110px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="lp-pop inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/80 px-4 py-1.5 text-xs text-gold-soft shadow-sm backdrop-blur">
              <Flame size={14} className="text-gold" /> The operating system for premium gyms
            </div>

            <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl xl:text-7xl">
              <Words text="Run every gym," />
              <br />
              <Words text="from one throne." delay={380} textClass="lp-shine-text italic" />
            </h1>

            <p className="lp-pop mt-7 max-w-xl text-lg leading-relaxed text-muted" style={{ animationDelay: "0.9s" }}>
              Members, memberships, billing, attendance, classes and reports in one beautifully
              crafted platform. Your gym feels premium. Now your software does too.
            </p>

            <div className="lp-pop mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "1.1s" }}>
              <Magnetic>
                <Link to="/signup" className="btn-gold flex items-center gap-2 px-8 py-4 text-base">
                  Create your gym account <ArrowRight size={18} />
                </Link>
              </Magnetic>
              <Magnetic>
                <a
                  href="#demo"
                  className="inline-block rounded-xl border border-line bg-white px-8 py-4 text-base shadow-sm transition hover:border-gold/50"
                >
                  Try the live demo
                </a>
              </Magnetic>
            </div>

            <div className="lp-pop mt-10 flex flex-wrap items-center gap-6" style={{ animationDelay: "1.3s" }}>
              <div className="flex items-center">
                {["R", "S", "I", "P"].map((a, i) => (
                  <div
                    key={a}
                    className="-ml-2 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-gold-light to-gold text-sm font-semibold text-charcoal first:ml-0"
                    style={{ zIndex: 10 - i }}
                  >
                    {a}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-muted">Loved by gym owners across India</p>
              </div>
            </div>
          </div>

          <HeroCollage />
        </div>
      </section>

      {/* ---------------- Marquee ---------------- */}
      <div className="overflow-hidden border-y border-gold/20 bg-white/70 py-5 backdrop-blur">
        <div className="lp-marquee flex w-max gap-12 whitespace-nowrap">
          {[0, 1].flatMap((k) =>
            [
              "Members",
              "Memberships",
              "QR Check-in",
              "Billing",
              "Classes",
              "Personal Training",
              "Inventory",
              "Leads",
              "WhatsApp CRM",
              "Analytics",
              "Multi-Branch",
              "Staff Roles",
            ].map((t) => (
              <span key={`${k}-${t}`} className="flex items-center gap-12 font-display text-lg text-charcoal/60">
                {t} <Dumbbell size={15} className="text-gold" />
              </span>
            ))
          )}
        </div>
      </div>

      {/* ---------------- Video + stats ---------------- */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>See it in motion</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Built for the <span className="gold-text">rhythm of a gym</span>
            </h2>
          </Reveal>
          <Reveal>
            <Cinematic />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { v: 12, s: "+", l: "Powerful modules" },
              { v: 100, s: "%", l: "Real-time data" },
              { v: 1, s: " login", l: "For every branch" },
              { v: 10, s: " min", l: "To your first member" },
            ].map((x, i) => (
              <Reveal key={x.l} delay={i * 90}>
                <Tilt className="rounded-[1.1rem]">
                  <div className="card p-7 text-center">
                    <p className="gold-text font-display text-4xl font-semibold">
                      <Count to={x.v} suffix={x.s} />
                    </p>
                    <p className="mt-2 text-sm text-muted">{x.l}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Live demo ---------------- */}
      <section id="demo" className="bg-white/60 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <Eyebrow>Interactive preview</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Click around. <span className="gold-text">It's alive.</span>
            </h2>
            <p className="mt-5 text-muted">
              A taste of the real portal. Pick a module, or let it play. Hover to pause.
            </p>
          </Reveal>
          <Reveal>
            <ProductDemo />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Everything you need</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              One platform. <span className="gold-text">Every detail.</span>
            </h2>
            <p className="mt-5 text-muted">
              From the first enquiry to the hundredth renewal, GYMOS covers the whole journey of a
              member and the whole day of your team.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {SHOWCASE.map(({ icon: Icon, title, text, img }, i) => (
              <Reveal key={title} delay={i * 110}>
                <Tilt className="rounded-3xl">
                  <div className="group relative h-[420px] overflow-hidden rounded-3xl border-[5px] border-white shadow-[0_25px_60px_-25px_rgba(120,90,20,0.5)]">
                    <Img src={img} alt={title} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-7">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-gold-light to-gold text-charcoal shadow-lg shadow-gold/40">
                        <Icon size={22} />
                      </div>
                      <h3 className="font-display text-2xl font-semibold text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/75">{text}</p>
                    </div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={(i % 3) * 90}>
                <Tilt className="h-full rounded-[1.1rem]" max={9}>
                  <div className="card group relative h-full overflow-hidden p-7 transition hover:border-gold/50">
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/10 blur-2xl transition group-hover:bg-gold/25" />
                    <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-gold/30 bg-gradient-to-br from-gold-light/50 to-gold/10 text-gold-soft transition group-hover:from-gold-light group-hover:to-gold group-hover:text-charcoal">
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <h3 className="relative mt-5 font-display text-lg font-semibold">{title}</h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-muted">{text}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Before / after ---------------- */}
      <section className="bg-white/60 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>Old way vs GYMOS</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Say goodbye to <span className="gold-text">the notebook</span>
            </h2>
            <p className="mt-5 text-muted">Drag the slider to see the difference.</p>
          </Reveal>
          <Reveal>
            <Compare />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Gym types gallery ---------------- */}
      <section className="overflow-hidden py-24">
        <Reveal className="mx-auto mb-12 max-w-2xl px-6 text-center">
          <Eyebrow>Every kind of floor</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
            From iron to <span className="gold-text">yoga mats</span>
          </h2>
          <p className="mt-5 text-muted">
            Strength, cardio, boxing, CrossFit or a boutique studio. GYMOS adapts to the way you train.
          </p>
        </Reveal>

        <div className="lp-marquee flex w-max gap-6 px-3">
          {[0, 1].flatMap((k) =>
            FLOORS.map((f) => (
              <div
                key={`${k}-${f.label}`}
                className="group relative h-[340px] w-[260px] shrink-0 overflow-hidden rounded-3xl border-[5px] border-white shadow-xl shadow-gold/20"
              >
                <Img src={f.img} alt={f.label} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/75 via-transparent to-transparent" />
                <p className="absolute bottom-5 left-5 font-display text-xl text-white">{f.label}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ---------------- ROI ---------------- */}
      <section id="roi" className="bg-white/60 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-soft">
              <Calculator size={22} />
            </div>
            <Eyebrow>Renewal calculator</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              What is a <span className="gold-text">lapsed member</span> worth?
            </h2>
            <p className="mt-5 text-muted">
              Every month some memberships quietly expire. Slide the numbers to match your gym.
            </p>
          </Reveal>
          <Reveal>
            <Roi />
          </Reveal>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Live in <span className="gold-text">three steps</span>
            </h2>
          </Reveal>

          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 140}>
                <div className="relative text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold/40 bg-white shadow-xl shadow-gold/25">
                    <span className="gold-text font-display text-2xl font-semibold">{s.n}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Testimonials ---------------- */}
      <section className="bg-white/60 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Loved by gym owners</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Built for people who <span className="gold-text italic">lift others</span>
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <Tilt className="h-full rounded-[1.1rem]" max={6}>
                  <div className="card relative h-full p-8">
                    <Quote size={34} className="text-gold/40" />
                    <p className="mt-4 leading-relaxed">{t.quote}</p>
                    <div className="mt-7 flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted">{t.role}</p>
                      </div>
                      <div className="ml-auto flex gap-0.5 text-gold">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <Star key={k} size={12} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Simple plans, <span className="gold-text">serious value</span>
            </h2>
            <p className="mt-5 text-muted">Pick the plan that fits your gym. Change it any time.</p>

            <div className="mx-auto mt-8 inline-flex rounded-full border border-line bg-white p-1 shadow-sm">
              {[
                { y: false, label: "Monthly" },
                { y: true, label: "Yearly" },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => setYearly(o.y)}
                  className={`rounded-full px-6 py-2 text-sm transition ${
                    yearly === o.y ? "bg-charcoal text-gold-light shadow" : "text-muted hover:text-charcoal"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="mt-16 grid items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p, i) => {
              const dark = p.popular;
              const body = (
                <>
                  <h3 className={`font-display text-2xl font-semibold ${dark ? "text-gold-light" : ""}`}>{p.name}</h3>
                  <div className="mt-6">
                    <span className="font-display text-5xl font-semibold">
                      {rupee(yearly ? p.priceYearly : p.priceMonthly)}
                    </span>
                    <span className={`text-sm ${dark ? "text-white/55" : "text-muted"}`}> / {yearly ? "year" : "month"}</span>
                  </div>

                  <div
                    className={`mt-6 grid grid-cols-2 gap-2 rounded-2xl border p-3 text-center ${
                      dark ? "border-white/10 bg-white/5" : "border-line bg-gold/5"
                    }`}
                  >
                    {[
                      ["Branches", limit(p.maxBranches)],
                      ["Members", limit(p.maxMembers)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-sm font-semibold">{v}</p>
                        <p className={`text-[11px] ${dark ? "text-white/50" : "text-muted"}`}>{k}</p>
                      </div>
                    ))}
                  </div>

                  <ul className="mt-7 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check size={17} className={`mt-0.5 shrink-0 ${dark ? "text-gold-light" : "text-gold-soft"}`} />
                        <span className={dark ? "text-white/80" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`mt-9 flex items-center justify-center gap-2 py-3.5 text-sm ${
                      dark ? "btn-gold" : "rounded-xl border border-gold/40 font-medium text-gold-soft transition hover:bg-gold/10"
                    }`}
                  >
                    Choose {p.name} <ArrowRight size={16} />
                  </Link>
                </>
              );

              return (
                <Reveal key={p.id} delay={i * 120} className="h-full">
                  {dark ? (
                    <div className="lp-border h-full xl:scale-105">
                      <div className="relative flex h-full flex-col rounded-[1.5rem] bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] p-9 text-white">
                        <span className="absolute -top-3.5 left-9 flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-light to-gold px-4 py-1 text-xs font-semibold text-charcoal shadow-lg shadow-gold/40">
                          <Star size={12} fill="currentColor" /> Most Popular
                        </span>
                        {body}
                      </div>
                    </div>
                  ) : (
                    <div className="card flex h-full flex-col p-9 transition hover:-translate-y-2 hover:border-gold/40">{body}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <Reveal className="text-center">
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              Good to <span className="gold-text">know</span>
            </h2>
          </Reveal>

          <div className="mt-12 space-y-4">
            {FAQ.map((f, i) => {
              const open = faq === i;
              return (
                <Reveal key={f.q} delay={i * 60}>
                  <div className={`card overflow-hidden transition ${open ? "!border-gold/50" : ""}`}>
                    <button
                      onClick={() => setFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-7 py-5 text-left"
                    >
                      <span className="font-display text-lg font-medium">{f.q}</span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/40 text-gold-soft">
                        {open ? <Minus size={15} /> : <Plus size={15} />}
                      </span>
                    </button>
                    <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <p className="px-7 pb-6 text-sm leading-relaxed text-muted">{f.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="px-6 pb-24">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border-[6px] border-white shadow-[0_40px_100px_-30px_rgba(120,90,20,0.55)]">
            <Img src={IMG.interior} alt="Gym" className="lp-kenburns absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-gold-soft/50" />
            <div className="relative px-8 py-20 text-center sm:px-16">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold-light to-gold text-charcoal shadow-2xl shadow-gold/40">
                <BadgeCheck size={28} />
              </div>
              <h2 className="mx-auto mt-8 max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-6xl">
                Give your gym the
                <br />
                <span className="lp-shine-text italic">flagship treatment.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-white/70">
                Join gym owners who run their entire business from one elegant dashboard.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Magnetic>
                  <Link to="/signup" className="btn-gold flex items-center gap-2 px-9 py-4">
                    <Sparkles size={17} /> Create your account <ArrowRight size={18} />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    to="/login"
                    className="inline-block rounded-xl border border-white/30 px-9 py-4 font-medium text-white backdrop-blur transition hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

    
          <LandingFooter />

      {/* floating call-to-action */}
      <div
        className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ${
          showCta ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <Link
          to="/signup"
          className="flex items-center gap-3 rounded-full border border-gold/40 bg-charcoal py-2.5 pl-6 pr-2.5 text-sm text-white shadow-2xl shadow-black/40"
        >
          Start your gym on GYMOS
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-charcoal">
            <ArrowRight size={16} />
          </span>
        </Link>
      </div>
    </div>
  );
}
