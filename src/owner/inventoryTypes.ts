import type { Timestamp } from "firebase/firestore";

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  createdAt?: Timestamp | null;
}

export type SupplierInput = Omit<Supplier, "id" | "createdAt">;

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  lowStockAt: number; // alert when stock is at or below this number
  supplierId: string; // "" = none
  supplierName: string;
  status: "active" | "inactive";
  createdAt?: Timestamp | null;
}

export type ProductInput = Pick<
  Product,
  "name" | "category" | "sku" | "unit" | "costPrice" | "sellPrice" | "lowStockAt" | "supplierId" | "status"
>;

export type StockMode = "in" | "out" | "adjust" | "sale";

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: StockMode;
  change: number; // signed: +10 or -2
  balance: number; // stock after this movement
  unitPrice: number; // sales only
  total: number; // sales only
  method: string; // sales only
  buyer: string; // sales only
  note: string;
  by: string;
  date: string; // "YYYY-MM-DD"
  createdAt?: Timestamp | null;
}

export type EquipmentStatus = "working" | "maintenance" | "out_of_order" | "retired";

export interface Equipment {
  id: string;
  name: string;
  category: string;
  brand: string;
  serialNo: string;
  branchId: string;
  branchName: string;
  purchaseDate: string; // "YYYY-MM-DD" or ""
  purchasePrice: number;
  warrantyUntil: string; // "YYYY-MM-DD" or ""
  serviceEveryDays: number; // 0 = no regular service
  lastServiceDate: string;
  nextServiceDate: string;
  status: EquipmentStatus;
  notes: string;
  createdAt?: Timestamp | null;
}

export type EquipmentInput = Pick<
  Equipment,
  | "name"
  | "category"
  | "brand"
  | "serialNo"
  | "branchId"
  | "purchaseDate"
  | "purchasePrice"
  | "warrantyUntil"
  | "serviceEveryDays"
  | "lastServiceDate"
  | "status"
  | "notes"
>;

export type EquipmentLogType = "service" | "repair" | "issue";

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: EquipmentLogType;
  date: string; // "YYYY-MM-DD"
  cost: number;
  notes: string;
  by: string;
  createdAt?: Timestamp | null;
}