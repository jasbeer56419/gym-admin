import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Dumbbell, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
    
      await login(email, password);
navigate("/dashboard", { replace: true });
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password?\".");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Password reset email sent. Please check your inbox and spam folder.");
    } catch {
      setError("Could not send the reset email. Check the address and try again.");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-[#fffaf0] via-[#f3e6c0] to-[#e3c96f] lg:flex lg:flex-col lg:justify-between lg:p-14">
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

        <div className="relative max-w-lg">
          <p className="mb-5 text-xs uppercase tracking-[0.35em] text-gold-soft">
            Gym Management Platform
          </p>
          <h1 className="font-display text-5xl font-semibold leading-tight text-charcoal">
            Run every gym,
            <br />
            <span className="italic text-[#7a5a0c]">from one throne.</span>
          </h1>
          <p className="mt-6 text-charcoal/70">
            Members, branches, memberships and revenue. Everything in one premium dashboard.
          </p>
        </div>

        <p className="relative text-xs text-charcoal/60">© GYMOS Platform</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="card w-full max-w-md p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Secure sign in</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Sign <span className="gold-text">in</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Enter your email and password to continue.
          </p>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <Mail
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-lux"
              />
            </div>

            <div className="relative">
              <Lock
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type={show ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-lux !pr-12"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgot}
                className="text-sm text-gold-soft hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-gold mt-6 flex w-full items-center justify-center gap-2 py-3"
          >
            {busy ? "Signing in..." : "Sign in"}
            {!busy && <ArrowRight size={17} />}
          </button>

          <p className="mt-6 text-center text-sm text-muted">
            New gym owner?{" "}
            <Link to="/signup" className="font-medium text-gold-soft hover:underline">
              Create your account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
