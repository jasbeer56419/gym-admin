import type { Timestamp } from "firebase/firestore";

export interface PtPackage {
  id: string;
  name: string;
  description: string;
  sessions: number;
  price: number;
  validityDays: number;
  status: "active" | "inactive";
  createdAt?: Timestamp | null;
}

export type PtPackageInput = Omit<PtPackage, "id" | "createdAt">;

export type PtStatus = "active" | "completed" | "expired" | "cancelled";

export interface PtClient {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberPhone: string;
  trainerId: string;
  trainerName: string;
  branchId: string;
  packageId: string;
  packageName: string;
  totalSessions: number;
  usedSessions: number;
  price: number;
  paid: number;
  startDate: string; // "YYYY-MM-DD"
  expiryDate: string; // "YYYY-MM-DD"
  status: PtStatus;
  createdAt?: Timestamp | null;
}

export type PtSessionStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface PtSession {
  id: string;
  ptId: string; // id of the PtClient document
  memberId: string;
  memberName: string;
  trainerId: string;
  trainerName: string;
  branchId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "07:00"
  endTime: string; // "08:00"
  status: PtSessionStatus;
  notes: string;
  createdAt?: Timestamp | null;
}