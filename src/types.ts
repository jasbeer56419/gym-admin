import type { Timestamp } from "firebase/firestore";

export type BusinessStatus = "pending" | "active" | "suspended";


export interface Business {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  plan: string;
  branches: number;
  status: BusinessStatus;
    ownerUid?: string;
  createdAt?: Timestamp | null;
}

export type BusinessInput = Omit<Business, "id" | "createdAt">;

export type PlanStatus = "active" | "inactive";

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number; // 0 = unlimited
  maxMembers: number; // 0 = unlimited
  maxStaff: number; // 0 = unlimited
  features: string[];
  popular: boolean;
  status: PlanStatus;
  createdAt?: Timestamp | null;
}

export type PlanInput = Omit<Plan, "id" | "createdAt">;

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
export type BillingCycle = "monthly" | "yearly";

export interface Payment {
  id: string;
  invoiceNo: string;
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  cycle: BillingCycle;
  amount: number;
  method: string;
  status: PaymentStatus;
  date: string; // "YYYY-MM-DD"
  note: string;
  createdAt?: Timestamp | null;
}

export type PaymentInput = Omit<Payment, "id" | "createdAt">;


export type UserRole = "super_admin" | "owner" | "manager" | "receptionist" | "trainer";
export type UserStatus = "active" | "disabled";

export interface AppUser {
  id: string; // = Firebase Auth UID
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
  businessName: string;
  status: UserStatus;
  createdAt?: Timestamp | null;
}

// ⬇️ Ye poora block apni src/types.ts ke END me paste kar do

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  module: string; // "Users" | "Businesses" | "Plans" | "Payments" | "Settings" | "Support"
  action: string; // "Created" | "Updated" | "Disabled" ...
  target: string; // kis par action hua
  createdAt?: Timestamp | null;
}

export type TicketPriority = "low" | "medium" | "high";
export type TicketStatus = "open" | "resolved";

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  businessName: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt?: Timestamp | null;
  resolvedAt?: Timestamp | null;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  invoicePrefix: string;
  trialDays: number;
  gstPercent: number;
}

export type BranchStatus = "active" | "inactive";

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  managerName: string;
  openTime: string; // "06:00"
  closeTime: string; // "22:00"
  weeklyOff: string;
  facilities: string[];
  status: BranchStatus;
  createdAt?: Timestamp | null;
}

export type BranchInput = Omit<Branch, "id" | "createdAt">;

export type DurationUnit = "day" | "month";

export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  price: number;
  joiningFee: number;
  maxFreezeDays: number;
  branchIds: string[]; // empty = valid at every branch
  inclusions: string[];
  isTrial: boolean;
  status: "active" | "inactive";
  createdAt?: Timestamp | null;
}

export type MembershipPlanInput = Omit<MembershipPlan, "id" | "createdAt">;

export type Gender = "male" | "female" | "other" | "";

export interface Member {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  gender: Gender;
  dob: string; // "YYYY-MM-DD"
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  goal: string;
  source: string;
  notes: string;
  branchId: string;
  branchName: string;
  membershipId: string | null;
  membershipPlanId: string;
  membershipPlan: string;
  membershipStart: string;
  membershipEnd: string;
  frozen: boolean;
  frozenOn: string;
  archived: boolean;
    lastVisit?: string;
  visitCount?: number;
    trainerId?: string;
  trainerName?: string;
  createdAt?: Timestamp | null;
}

export type MemberInput = Pick<
  Member,
  | "name"
  | "phone"
  | "email"
  | "gender"
  | "dob"
  | "address"
  | "emergencyName"
  | "emergencyPhone"
  | "goal"
  | "source"
  | "notes"
  | "branchId"
>;

export interface Membership {
  id: string;
  memberId: string;
  memberName: string;
  branchId: string;
  planId: string;
  planName: string;
  type: "new" | "renewal" | "upgrade";
  startDate: string;
  endDate: string;
  price: number;
  joiningFee: number;
  discount: number;
  total: number;
  paid: number;
  maxFreezeDays: number;
  freezeDaysUsed: number;
  status: "active" | "replaced";
    refunded?: number;
      soldById?: string;
  soldByName?: string;
  createdAt?: Timestamp | null;
}

export interface MemberPayment {
  id: string;
  invoiceNo: string;
  memberId: string;
  memberName: string;
  membershipId: string;
  planName: string;
  branchId: string;
  amount: number;
  method: string;
  date: string; // "YYYY-MM-DD"
  note: string;
  status: "paid";
    type?: "membership" | "due";
      collectedById?: string;
  collectedByName?: string;
  collectedByRole?: string;
  refundedAmount?: number;
 
    refunds?: { amount: number; date: string; reason: string; by?: string }[];
  createdAt?: Timestamp | null;
}

export interface BusinessSettings {
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  gstRate: number; // 0 = no GST
  showGst: boolean; // show the GST breakup on receipts
  receiptNote: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  branchId: string;
  branchName: string;
  date: string; // "YYYY-MM-DD"
  checkInAt?: Timestamp | null;
  checkOutAt?: Timestamp | null;
  planName: string;
  entryStatus: string;
  override: boolean;
  overrideReason: string;
}

export type StaffRole = "manager" | "receptionist" | "trainer";

export interface StaffShift {
  days: string[]; // e.g. ["Mon", "Tue"]
  start: string; // "06:00"
  end: string; // "14:00"
}

export interface StaffMember {
  id: string; // = Firebase Auth UID
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  branchIds: string[]; // empty = all branches
  specialization: string;
  shift: StaffShift;
  status: "active" | "disabled";
  createdAt?: Timestamp | null;
}

export interface StaffPrivate {
  salary: number;
  ptCommission: number; // percent
  classCommission: number; // percent
  joinDate: string;
  notes: string;
}

export type LeadStatus = "new" | "contacted" | "trial" | "negotiation" | "converted" | "lost";

export interface LeadActivity {
  at: string; // ISO date-time
  type: string;
  note: string;
  by: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  interest: string;
  branchId: string;
  branchName: string;
  status: LeadStatus;
  nextFollowUp: string; // "YYYY-MM-DD" or ""
  lastContact: string;
  notes: string;
  lostReason: string;
  memberId: string | null;
  convertedOn: string;
  activity: LeadActivity[];
  createdByName: string;
  createdAt?: Timestamp | null;
}

export type LeadInput = Pick<
  Lead,
  "name" | "phone" | "email" | "source" | "interest" | "branchId" | "nextFollowUp" | "notes"
>;

export interface GymClass {
  id: string;
  name: string;
  description: string;
  trainerId: string; // "" = no trainer
  trainerName: string;
  branchId: string;
  branchName: string;
  days: string[]; // ["Mon", "Wed", "Fri"]
  startTime: string; // "07:00"
  endTime: string; // "08:00"
  capacity: number;
  status: "active" | "inactive";
  createdAt?: Timestamp | null;
}

export type GymClassInput = Pick<
  GymClass,
  | "name"
  | "description"
  | "trainerId"
  | "branchId"
  | "days"
  | "startTime"
  | "endTime"
  | "capacity"
  | "status"
>;

export type RosterStatus = "booked" | "attended" | "no_show";

export interface RosterEntry {
  memberId: string;
  name: string;
  code: string;
  phone: string;
  status: RosterStatus;
  at: string; // ISO date-time of booking
}

export interface WaitEntry {
  memberId: string;
  name: string;
  code: string;
  phone: string;
  at: string;
}

export interface ClassSession {
  id: string; // classId_YYYY-MM-DD
  classId: string;
  className: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  branchId: string;
  branchName: string;
  trainerId: string;
  trainerName: string;
  capacity: number;
  roster: RosterEntry[];
  waitlist: WaitEntry[];
  memberIds: string[]; // roster + waitlist ids
  cancelled: boolean;
  createdAt?: Timestamp | null;
}

