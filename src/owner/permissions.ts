import { useAuth } from "../AuthContext";
import { useOwner } from "./OwnerContext";
import type { StaffMember } from "../types";

export const ROLE_LABEL: Record<string, string> = {
  owner: "Gym Owner",
  manager: "Manager",
  receptionist: "Receptionist",
  trainer: "Trainer",
};

// A staff document may carry the checkboxes the owner ticked
export type StaffWithPermissions = StaffMember & { permissions?: string[] };

export type PermissionDef = {
  key: string;
  label: string;
  help: string;
  defaults: string[]; // roles that get this by default (the owner always has everything)
  requires?: string; // an action needs its page
  path?: string; // pages only
};

// Pages a staff member can open
export const MODULE_PERMISSIONS: PermissionDef[] = [
  {
    key: "module.members",
    label: "Members",
    help: "See the member list and profiles.",
    defaults: ["manager", "receptionist", "trainer"],
    path: "/app/members",
  },
  {
    key: "module.leads",
    label: "Leads & Sales",
    help: "Add enquiries, log follow-ups and convert leads.",
    defaults: ["manager", "receptionist"],
    path: "/app/leads",
  },
  {
    key: "module.classes",
    label: "Classes & Activities",
    help: "See the class schedule and rosters.",
    defaults: ["manager", "receptionist", "trainer"],
    path: "/app/classes",
  },
  {
    key: "module.training",
    label: "Personal Training",
    help: "See training packages, clients and sessions.",
    defaults: ["manager", "trainer"],
    path: "/app/training",
  },
  {
    key: "module.attendance",
    label: "Attendance & Access",
    help: "Check members in and out at the desk.",
    defaults: ["manager", "receptionist"],
    path: "/app/attendance",
  },
  {
    key: "module.billing",
    label: "Billing & Payments",
    help: "See payments, collect dues and print receipts.",
    defaults: ["manager", "receptionist"],
    path: "/app/billing",
  },
  {
    key: "module.inventory",
    label: "Inventory & Equipment",
    help: "Manage products, stock, sales and equipment.",
    defaults: ["manager"],
    path: "/app/inventory",
  },
  {
    key: "module.notifications",
    label: "Notifications & CRM",
    help: "Send WhatsApp and SMS reminders.",
    defaults: ["manager"],
    path: "/app/notifications",
  },
  {
    key: "module.reports",
    label: "Reports & Analytics",
    help: "See revenue, member and attendance reports.",
    defaults: ["manager"],
    path: "/app/reports",
  },
];

// Things a staff member can do inside those pages
export const ACTION_PERMISSIONS: PermissionDef[] = [
  {
    key: "members.write",
    label: "Add and edit members",
    help: "Register members, assign memberships, freeze and archive.",
    defaults: ["manager", "receptionist"],
    requires: "module.members",
  },
  {
    key: "billing.refund",
    label: "Refund payments",
    help: "Issue refunds on member payments.",
    defaults: ["manager"],
    requires: "module.billing",
  },
  {
    key: "leads.delete",
    label: "Delete leads",
    help: "Permanently delete a lead.",
    defaults: ["manager"],
    requires: "module.leads",
  },
  {
    key: "classes.manage",
    label: "Create and edit classes",
    help: "Add, change, deactivate and delete classes.",
    defaults: ["manager"],
    requires: "module.classes",
  },
  {
    key: "classes.book",
    label: "Book members into classes",
    help: "Book, remove and cancel class bookings.",
    defaults: ["manager", "receptionist"],
    requires: "module.classes",
  },
  {
    key: "classes.attend",
    label: "Mark class attendance",
    help: "Mark members present or no-show.",
    defaults: ["manager", "receptionist", "trainer"],
    requires: "module.classes",
  },
  {
    key: "training.manage",
    label: "Manage personal training",
    help: "Create packages, assign them to members, collect dues.",
    defaults: ["manager"],
    requires: "module.training",
  },
];

export const ALL_PERMISSIONS = [...MODULE_PERMISSIONS, ...ACTION_PERMISSIONS];

/** What a role gets when the owner has not customised anything. */
export const defaultPermissions = (role: string): string[] =>
  ALL_PERMISSIONS.filter((p) => p.defaults.includes(role)).map((p) => p.key);

// Pages that only the owner can open, whatever the checkboxes say
const OWNER_ONLY = ["/app/staff", "/app/memberships", "/app/branches", "/app/settings"];

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

export type Action =
  | "members.write"
  | "billing.refund"
  | "billing.view"
  | "leads.delete"
  | "classes.manage"
  | "classes.book"
  | "classes.attend"
  | "training.manage";

export function usePermissions() {
  const { role } = useAuth();
  const { myPermissions } = useOwner();

  const granted = (key: string) => {
    if (!role) return false;
    if (role === "owner") return true;
    return (myPermissions ?? defaultPermissions(role)).includes(key);
  };

  const can = (action: Action) => granted(action === "billing.view" ? "module.billing" : action);

  const canAccess = (path: string) => {
    if (!role) return false;
    if (OWNER_ONLY.some((b) => under(path, b))) return role === "owner";
    const mod = MODULE_PERMISSIONS.find((m) => m.path && under(path, m.path));
    return mod ? granted(mod.key) : true;
  };

  return { role, can, canAccess };
}
