import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  type UserCredential,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowRight,
  Building2,
  Check,
  Dumbbell,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
} from "lucide-react";
import { auth, db } from "../firebase";
import { useAuth } from "../AuthContext";
import type { Plan } from "../types";

const authError = (code: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled. Please contact support.";
    default:
      return "We could not create your account. Please try again.";
  }
};

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const limit = (n: number) => (n === 0 ? "Unlimited" : n.toLocaleString("en-IN"));

const benefits = [
  "Members, memberships and renewals",
  "Multi-branch management",
  "Billing, invoices and dues",
  "Attendance, classes and trainers",
];

export default function Signup() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    gymName: "",
    city: "",
    plan: "",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "plans"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Plan)
        .filter((p) => p.status === "active")
        .sort((a, b) => a.priceMonthly - b.priceMonthly);
      setPlans(list);
      // Pre-select the most popular plan (or the first one)
      setForm((f) =>
        f.plan ? f : { ...f, plan: (list.find((p) => p.popular) ?? list[0])?.name ?? "" }
      );
    });
    return unsub;
  }, []);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (plans.length > 0 && !form.plan) {
      setError("Please choose a plan.");
      return;
    }

    setBusy(true);
    const email = form.email.trim().toLowerCase();

    // 1) Create the login account
    let cred: UserCredential;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, form.password);
    } catch (err) {
      setError(err instanceof FirebaseError ? authError(err.code) : authError(""));
      setBusy(false);
      return;
    }

    // 2) Create the gym business + owner profile in ONE atomic write
    try {
      const bizRef = doc(collection(db, "businesses"));
      const batch = writeBatch(db);

      batch.set(bizRef, {
        name: form.gymName.trim(),
        ownerName: form.ownerName.trim(),
        ownerEmail: email,
        phone: form.phone.trim(),
        city: form.city.trim(),
        plan: form.plan,
        branches: 1,
        status: "pending",
        ownerUid: cred.user.uid,
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, "users", cred.user.uid), {
        name: form.ownerName.trim(),
        email,
        role: "owner",
        businessId: bizRef.id,
        businessName: form.gymName.trim(),
        status: "active",
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      await refreshProfile();
      navigate("/");
    } catch {
      // Roll back the login account so the person can try again with the same email
      try {
        await deleteUser(cred.user);
      } catch {
        /* ignore */
      }
      setError("We could not set up your gym. Please try again.");
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";
  const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 text-muted";

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-[#fffaf0] via-[#f3e6c0] to-[#e3c96f] lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-white/60 blur-[90px]" />
        <div className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-gold/40 blur-[110px]" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-charcoal text-gold-light shadow-xl shadow-black/20">
            <Dumbbell size={22} strokeWidth={2.2} />
          </div>
          <span className="font-display text-2xl font-semibold tracking-wide text-charcoal">
            GYMOS
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="mb-5 text-xs uppercase tracking-[0.35em] text-gold-soft">
            For gym owners
          </p>
          <h1 className="font-display text-5xl font-semibold leading-tight text-charcoal">
            Run your entire gym
            <br />
            <span className="italic text-[#7a5a0c]">from one place.</span>
          </h1>
          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-charcoal/80">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-charcoal text-gold-light">
                  <Check size={14} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-charcoal/60">© GYMOS Platform</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-6 lg:items-center">
        <form onSubmit={handleSubmit} className="card my-8 w-full max-w-2xl p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Get started</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Create your <span className="gold-text">gym account</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Tell us about you and your gym. Our team will review and activate your account.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Your Name</label>
              <div className="relative">
                <User size={17} className={iconCls} />
                <input
                  className="input-lux"
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={label}>Phone</label>
              <div className="relative">
                <Phone size={17} className={iconCls} />
                <input
                  className="input-lux"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={label}>Email</label>
              <div className="relative">
                <Mail size={17} className={iconCls} />
                <input
                  type="email"
                  className="input-lux"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={label}>Password</label>
              <div className="relative">
                <Lock size={17} className={iconCls} />
                <input
                  type={show ? "text" : "password"}
                  minLength={6}
                  className="input-lux !pr-12"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className={label}>Confirm Password</label>
              <div className="relative">
                <Lock size={17} className={iconCls} />
                <input
                  type={show ? "text" : "password"}
                  className="input-lux"
                  value={form.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={label}>Gym Name</label>
              <div className="relative">
                <Building2 size={17} className={iconCls} />
                <input
                  className="input-lux"
                  placeholder="e.g. FitZone Fitness"
                  value={form.gymName}
                  onChange={(e) => set("gymName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={label}>City</label>
              <div className="relative">
                <MapPin size={17} className={iconCls} />
                <input
                  className="input-lux"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {plans.length > 0 && (
            <div className="mt-8">
              <p className={label}>Choose your plan</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {plans.map((p) => {
                  const on = form.plan === p.name;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set("plan", p.name)}
                      className={`relative rounded-2xl border p-4 text-left transition ${
                        on
                          ? "border-gold bg-gold/10 shadow-md shadow-gold/20"
                          : "border-line bg-white hover:border-gold/40"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2.5 right-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-light to-gold px-2 py-0.5 text-[10px] font-semibold text-charcoal">
                          <Star size={10} fill="currentColor" /> Popular
                        </span>
                      )}
                      <p className="font-display text-lg font-semibold">{p.name}</p>
                      <p className="mt-1 text-sm">
                        <b>{rupee(p.priceMonthly)}</b>
                        <span className="text-xs text-muted"> / month</span>
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {limit(p.maxBranches)} branches · {limit(p.maxMembers)} members
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                You can change your plan later by contacting us.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-gold mt-6 flex w-full items-center justify-center gap-2 py-3"
          >
            {busy ? "Creating your account..." : "Create account"}
            {!busy && <ArrowRight size={17} />}
          </button>

          <p className="mt-5 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-gold-soft hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}