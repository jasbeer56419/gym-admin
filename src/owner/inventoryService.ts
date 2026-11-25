import { collection, doc, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import type { Equipment, EquipmentLogType, StockMode } from "./inventoryTypes";
import { addDays, rupee } from "./utils";

export type StockChange = {
  mode: StockMode;
  qty: number; // for "adjust" this is the NEW total count
  note: string;
  by: string;
  date: string;
  unitPrice?: number;
  method?: string;
  buyer?: string;
};

/**
 * Changes the stock of one product and writes a history row, in one transaction.
 * Stock can never go below zero, even if two people sell at the same time.
 * Returns a message to show on screen.
 */
export async function changeStock(
  businessId: string,
  productId: string,
  c: StockChange
): Promise<string> {
  const pRef = doc(db, "businesses", businessId, "inventoryItems", productId);
  const mRef = doc(collection(db, "businesses", businessId, "stockMovements"));

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(pRef);
    if (!snap.exists()) throw new Error("This product no longer exists.");

    const current: number = snap.data().stock ?? 0;
    const name: string = snap.data().name ?? "";

    let change: number;
    if (c.mode === "in") {
      change = c.qty;
    } else if (c.mode === "adjust") {
      change = c.qty - current;
      if (change === 0) throw new Error(`The stock is already ${current}.`);
    } else {
      if (c.qty > current) throw new Error(`Only ${current} in stock.`);
      change = -c.qty;
    }

    const balance = current + change;
    const unitPrice = c.mode === "sale" ? (c.unitPrice ?? 0) : 0;
    const total = c.mode === "sale" ? unitPrice * c.qty : 0;

    tx.update(pRef, { stock: balance });
    tx.set(mRef, {
      itemId: productId,
      itemName: name,
      type: c.mode,
      change,
      balance,
      unitPrice,
      total,
      method: c.method ?? "",
      buyer: c.buyer ?? "",
      note: c.note,
      by: c.by,
      date: c.date,
      createdAt: serverTimestamp(),
    });

    if (c.mode === "sale") return `Sold ${c.qty} × ${name} for ${rupee(total)}. Stock left: ${balance}.`;
    if (c.mode === "in") return `Added ${c.qty} to ${name}. Stock is now ${balance}.`;
    if (c.mode === "out") return `Removed ${c.qty} from ${name}. Stock is now ${balance}.`;
    return `${name} stock corrected to ${balance}.`;
  });
}

/**
 * Adds a maintenance log and updates the machine in one batch.
 * - Service or repair: machine becomes "working" and the next service date is set.
 * - Issue: machine becomes "out of order".
 */
export async function logMaintenance(
  businessId: string,
  item: Equipment,
  input: { type: EquipmentLogType; date: string; cost: number; notes: string; by: string }
) {
  const batch = writeBatch(db);

  batch.set(doc(collection(db, "businesses", businessId, "equipmentLogs")), {
    equipmentId: item.id,
    equipmentName: item.name,
    type: input.type,
    date: input.date,
    cost: input.cost,
    notes: input.notes,
    by: input.by,
    createdAt: serverTimestamp(),
  });

  const ref = doc(db, "businesses", businessId, "equipment", item.id);
  if (input.type === "issue") {
    batch.update(ref, { status: "out_of_order" });
  } else {
    batch.update(ref, {
      status: "working",
      lastServiceDate: input.date,
      nextServiceDate: item.serviceEveryDays > 0 ? addDays(input.date, item.serviceEveryDays) : "",
    });
  }

  await batch.commit();
}