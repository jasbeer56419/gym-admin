import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ROLE_LABEL, usePermissions } from "./permissions";
import {
  LayoutDashboard,
  Users,
  Target,
  UserCog,
  BadgeCheck,
  CalendarDays,
  Dumbbell,
  QrCode,
  CreditCard,
  Package,
  Bell,
  BarChart3,
  GitBranch,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useOwner } from "./OwnerContext";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    title: "People",
    items: [
      { to: "/app/members", label: "Members", icon: Users },
      { to: "/app/leads", label: "Leads & Sales", icon: Target },
      { to: "/app/staff", label: "Trainers & Staff", icon: UserCog },
    ],
  },
  {
    title: "Gym Operations",
    items: [
      { to: "/app/memberships", label: "Membership Plans", icon: BadgeCheck },
      { to: "/app/classes", label: "Classes & Activities", icon: CalendarDays },
      { to: "/app/training", label: "Personal Training", icon: Dumbbell },
      { to: "/app/attendance", label: "Attendance & Access", icon: QrCode },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/app/billing", label: "Billing & Payments", icon: CreditCard },
      { to: "/app/inventory", label: "Inventory & Equipment", icon: Package },
      { to: "/app/notifications", label: "Notifications & CRM", icon: Bell },
      { to: "/app/reports", label: "Reports & Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Setup",
    items: [
      { to: "/app/branches", label: "Branches", icon: GitBranch },
      { to: "/app/settings", label: "Business Settings", icon: Settings },
    ],
  },
];

function Screen({
  title,
  text,
  onLogout,
}: {
  title: string;
  text: ReactNode;
  onLogout: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-10 text-center">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-3 text-sm text-muted">{text}</p>
        <button onClick={onLogout} className="btn-gold mt-6 px-6 py-2.5">
          Log out
        </button>
      </div>
    </div>
  );
}

export default function OwnerLayout() {
  const { user, profile, logout } = useAuth();
  const { business, branches, branchId, setBranchId, loading, error } = useOwner();
  const { canAccess } = usePermissions();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  if (!profile?.businessId) {
    return (
      <Screen
        title="No gym linked"
        text="Your account is not linked to a gym business yet. Please contact the platform administrator."
        onLogout={logout}
      />
    );
  }

  if (error || !business) {
    return (
      <Screen
        title="Gym not available"
        text="We could not load your gym. Please check your connection or contact the platform administrator."
        onLogout={logout}
      />
    );
  }

  if (business.status === "pending") {
    return (
      <Screen
        title="Awaiting approval"
        text="Thank you for signing up! Your gym account is being reviewed by our team. This page will open automatically as soon as your account is approved."
        onLogout={logout}
      />
    );
  }

  if (business.status === "suspended") {
    return (
      <Screen
        title="Account suspended"
        text="Your gym's account is currently suspended. Please contact platform support to restore access."
        onLogout={logout}
      />
    );
  }

  const displayName = profile.name || user?.email || "Owner";
  const initial = displayName[0].toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-7">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal font-display text-lg font-semibold text-gold-light shadow-lg shadow-black/20">
          {business.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{business.name}</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
            {profile.role === "owner" ? "Owner Portal" : "Staff Portal"}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups
          .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(i.to)) }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.title} className="mb-4">
              <p className="px-4 pb-2 text-[10px] uppercase tracking-[0.25em] text-muted">
                {g.title}
              </p>
              <div className="space-y-1">
                {g.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                        isActive
                          ? "border-gold/40 bg-gradient-to-r from-gold/20 to-gold/5 font-medium text-gold-soft shadow-sm"
                          : "border-transparent text-muted hover:bg-black/[0.04] hover:text-charcoal"
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
      </nav>

      <div className="m-4 rounded-2xl bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] p-4 text-white shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-xs text-gold-light">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-sm text-white/70 transition hover:border-gold/50 hover:text-white"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-white/70 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
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

          {/* Branch switcher */}
          <div className="relative">
            <GitBranch
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-soft"
            />
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="input-lux !py-2.5 !pl-10 text-sm sm:min-w-[200px]"
            >
              <option value="all">All branches</option>
              {branches
                .filter((b) => b.status === "active")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-gold/50 hover:text-charcoal">
              <Bell size={18} />
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal shadow-md shadow-gold/30">
              {initial}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10">
          {canAccess(location.pathname) ? (
            <Outlet />
          ) : (
            <div className="card grid place-items-center p-16 text-center">
              <h2 className="font-display text-2xl">No access</h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                You do not have access to this module. Please ask the gym owner if you need it.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
