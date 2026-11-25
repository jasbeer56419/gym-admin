import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { ClassSession, GymClass, Member, RosterStatus } from "../types";
import { sessionId } from "./classUtils";

const refOf = (businessId: string, sid: string) =>
  doc(db, "businesses", businessId, "classSessions", sid);

const blank = (c: GymClass, date: string) => ({
  classId: c.id,
  className: c.name,
  date,
  startTime: c.startTime,
  endTime: c.endTime,
  branchId: c.branchId,
  branchName: c.branchName,
  trainerId: c.trainerId,
  trainerName: c.trainerName,
  capacity: c.capacity,
  roster: [] as ClassSession["roster"],
  waitlist: [] as ClassSession["waitlist"],
  memberIds: [] as string[],
  cancelled: false,
});

const idsOf = (roster: ClassSession["roster"], waitlist: ClassSession["waitlist"]) => [
  ...roster.map((r) => r.memberId),
  ...waitlist.map((w) => w.memberId),
];

/** Books the member, or puts them on the waitlist when the class is full. */
export async function bookMember(
  businessId: string,
  c: GymClass,
  date: string,
  m: Member
): Promise<"booked" | "waitlist"> {
  const ref = refOf(businessId, sessionId(c.id, date));

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const s = snap.exists() ? (snap.data() as ClassSession) : null;

    if (s?.cancelled) throw new Error("This class is cancelled on this date.");
    if ((s?.memberIds ?? []).includes(m.id)) {
      throw new Error(`${m.name} is already booked or on the waitlist.`);
    }

    const roster = [...(s?.roster ?? [])];
    const waitlist = [...(s?.waitlist ?? [])];
    const entry = {
      memberId: m.id,
      name: m.name,
      code: m.code,
      phone: m.phone,
      at: new Date().toISOString(),
    };

    let result: "booked" | "waitlist";
    if (roster.length < c.capacity) {
      roster.push({ ...entry, status: "booked" });
      result = "booked";
    } else {
      waitlist.push(entry);
      result = "waitlist";
    }

    const changed = { roster, waitlist, memberIds: idsOf(roster, waitlist), capacity: c.capacity };
    tx.set(
      ref,
      snap.exists()
        ? changed
        : { ...blank(c, date), ...changed, createdAt: serverTimestamp() }
    );
    return result;
  });
}

/**
 * Removes a member from the roster or waitlist.
 * If a seat opens up, the first person on the waitlist is promoted.
 * Returns the name of the promoted member, if any.
 */
export async function removeFromSession(
  businessId: string,
  sid: string,
  memberId: string
): Promise<string | null> {
  const ref = refOf(businessId, sid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const s = snap.data() as ClassSession;

    let roster = s.roster ?? [];
    let waitlist = s.waitlist ?? [];
    let promoted: string | null = null;

    if (roster.some((r) => r.memberId === memberId)) {
      roster = roster.filter((r) => r.memberId !== memberId);
      const next = waitlist[0];
      if (next && roster.length < s.capacity) {
        roster = [
          ...roster,
          {
            memberId: next.memberId,
            name: next.name,
            code: next.code,
            phone: next.phone,
            status: "booked",
            at: new Date().toISOString(),
          },
        ];
        waitlist = waitlist.slice(1);
        promoted = next.name;
      }
    } else {
      waitlist = waitlist.filter((w) => w.memberId !== memberId);
    }

    tx.update(ref, { roster, waitlist, memberIds: idsOf(roster, waitlist) });
    return promoted;
  });
}

/** Marks Present or No-show. Clicking the same status again goes back to "booked". */
export async function setAttendance(
  businessId: string,
  sid: string,
  memberId: string,
  status: Exclude<RosterStatus, "booked">
) {
  const ref = refOf(businessId, sid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This booking sheet no longer exists.");
    const s = snap.data() as ClassSession;
    const roster = (s.roster ?? []).map((r) =>
      r.memberId === memberId
        ? { ...r, status: (r.status === status ? "booked" : status) as RosterStatus }
        : r
    );
    tx.update(ref, { roster });
  });
}

/** Cancels (or restores) one class on one date. */
export async function setSessionCancelled(
  businessId: string,
  c: GymClass,
  date: string,
  cancelled: boolean
) {
  const ref = refOf(businessId, sessionId(c.id, date));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    tx.set(
      ref,
      snap.exists()
        ? { cancelled }
        : { ...blank(c, date), cancelled, createdAt: serverTimestamp() }
    );
  });
}