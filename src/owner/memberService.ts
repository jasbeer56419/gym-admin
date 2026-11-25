import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Branch, Member, MemberInput } from "../types";

export async function createMember(
  businessId: string,
  data: MemberInput,
  branches: Branch[]
): Promise<Member> {
  const branch = branches.find((b) => b.id === data.branchId);
  const memberRef = doc(collection(db, "businesses", businessId, "members"));
  let code = "";

  await runTransaction(db, async (tx) => {
    const counterRef = doc(db, "businesses", businessId, "meta", "counters");
    const c = await tx.get(counterRef);
    const next = (c.exists() ? (c.data().memberSeq ?? 0) : 0) + 1;
    tx.set(counterRef, { memberSeq: next }, { merge: true });
    code = `M-${String(next).padStart(4, "0")}`;
    tx.set(memberRef, {
      ...data,
      code,
      branchName: branch?.name ?? "",
      membershipId: null,
      membershipPlanId: "",
      membershipPlan: "",
      membershipStart: "",
      membershipEnd: "",
      frozen: false,
      frozenOn: "",
      archived: false,
      createdAt: serverTimestamp(),
    });
  });

  return {
    id: memberRef.id,
    code,
    ...data,
    branchName: branch?.name ?? "",
    membershipId: null,
    membershipPlanId: "",
    membershipPlan: "",
    membershipStart: "",
    membershipEnd: "",
    frozen: false,
    frozenOn: "",
    archived: false,
    createdAt: null,
  };
}