import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Crown,
  CreditCard,
  Users,
  Settings,
  BarChart3,
  LifeBuoy,
  LogOut,
  Search,
  Bell,
  Menu,
  Dumbbell,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const nav = [
 
  { to: "/dashboard", label: "Platform Dashboard", icon: LayoutDashboard, end: true },
  { to: "/businesses", label: "Manage Businesses", icon: Building2 },
  { to: "/plans", label: "Subscription Plans", icon: Crown },
  { to: "/payments", label: "Payments & Invoices", icon: CreditCard },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/settings", label: "System Settings", icon: Settings },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/support", label: "Support & Logs", icon: LifeBuoy },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (user?.email ?? "A")[0].toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-7">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal text-gold-light shadow-lg shadow-black/20">
          <Dumbbell size={20} strokeWidth={2.2} />
        </div>
        <div>
          <p className="gold-text font-display text-xl font-semibold tracking-wide">
            GYMOS
          </p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
            Platform Control
          </p>
        </div>
      </div>

      <p className="px-6 pb-2 text-[10px] uppercase tracking-[0.25em] text-muted">
        Menu
      </p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                isActive
                  ? "border-gold/40 bg-gradient-to-r from-gold/20 to-gold/5 font-medium text-gold-soft shadow-sm"
                  : "border-transparent text-muted hover:bg-black/[0.04] hover:text-charcoal"
              }`
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="m-4 rounded-2xl bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] p-4 text-white shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-gold-light">Super Admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-sm text-white/70 transition hover:border-gold/50 hover:text-white"
        >
          <LogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-white/70 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-line bg-page">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-white/70 px-6 py-4 backdrop-blur-xl lg:px-10">
          <button
            className="text-muted hover:text-charcoal lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder="Search businesses, members, invoices..."
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-gold/50 hover:text-charcoal">
              <Bell size={18} />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-gold" />
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal shadow-md shadow-gold/30">
              {initial}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
