import { doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { PtSession } from "./ptTypes";

/**
 * Marks a session as completed and adds one to the client's used sessions.
 * Done in a transaction so the same session can never be counted twice.
 */
export async function completeSession(businessId: string, session: PtSession, notes: string) {
  const sRef = doc(db, "businesses", businessId, "ptSessions", session.id);
  const cRef = doc(db, "businesses", businessId, "ptClients", session.ptId);

  await runTransaction(db, async (tx) => {
    const [s, c] = await Promise.all([tx.get(sRef), tx.get(cRef)]);
    if (!s.exists()) throw new Error("This session no longer exists.");
    if (!c.exists()) throw new Error("This training package no longer exists.");
    if (s.data().status !== "scheduled") {
      throw new Error("This session has already been updated.");
    }
    if (c.data().status === "cancelled") {
      throw new Error("This training package was cancelled.");
    }

    const used = (c.data().usedSessions ?? 0) + 1;
    const total = c.data().totalSessions ?? 0;

    tx.update(sRef, { status: "completed", notes, completedAt: serverTimestamp() });
    tx.update(cRef, {
      usedSessions: used,
      status: used >= total ? "completed" : c.data().status,
    });
  });
}

/** Cancel or no-show. Neither of these uses up a session from the package. */
export async function setSessionStatus(
  businessId: string,
  sessionId: string,
  status: "cancelled" | "no_show"
) {
  await updateDoc(doc(db, "businesses", businessId, "ptSessions", sessionId), { status });
}