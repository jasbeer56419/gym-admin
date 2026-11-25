import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Records any action in auditLogs.
 * If it fails, the main task is not interrupted (silent).
 * Usage: await logAction("Users", "Disabled", "Rahul (rahul@gmail.com)");
 */
export async function logAction(module: string, action: string, target: string) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      actorId: auth.currentUser?.uid ?? "",
      actorEmail: auth.currentUser?.email ?? "",
      module,
      action,
      target,
      createdAt: serverTimestamp(),
    });
  } catch {
    /* a failed log should never stop the user's work */
  }
}
