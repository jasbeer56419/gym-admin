import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import type { Branch, Business, Plan } from "../types";

type OwnerState = {
  businessId: string | null;
  business: Business | null;
  plan: Plan | null;
  branches: Branch[];
  branchId: string; // "all" or a branch id
  setBranchId: (id: string) => void;
  // Checkboxes the owner ticked for the logged-in staff member.
  // null = nothing customised, so the role defaults apply.
  myPermissions: string[] | null;
  loading: boolean;
  error: string;
};

const OwnerContext = createContext<OwnerState>(null as unknown as OwnerState);

export const useOwner = () => useContext(OwnerContext);

type Key = "business" | "plans" | "branches";

export function OwnerProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const businessId = profile?.businessId ?? null;
  const role = profile?.role ?? null;
  const uid = user?.uid ?? null;

  const [business, setBusiness] = useState<Business | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loaded, setLoaded] = useState({ business: false, plans: false, branches: false });
  const [error, setError] = useState("");
  const [savedBranch, setSavedBranch] = useState("all");
  const [myPermissions, setMyPermissions] = useState<string[] | null>(null);
  const [permsLoaded, setPermsLoaded] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    const mark = (k: Key) => setLoaded((l) => ({ ...l, [k]: true }));
    const fail = (k: Key) => () => {
      setError("Could not load your gym data. Please try again.");
      mark(k);
    };

    const unsubBusiness = onSnapshot(
      doc(db, "businesses", businessId),
      (snap) => {
        setBusiness(snap.exists() ? ({ id: snap.id, ...snap.data() } as Business) : null);
        mark("business");
      },
      fail("business")
    );

    const unsubPlans = onSnapshot(
      collection(db, "plans"),
      (snap) => {
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plan));
        mark("plans");
      },
      fail("plans")
    );

    const unsubBranches = onSnapshot(
      collection(db, "businesses", businessId, "branches"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
        list.sort(
          (a, b) => (a.createdAt?.seconds ?? 9e12) - (b.createdAt?.seconds ?? 9e12)
        );
        setBranches(list);
        mark("branches");
      },
      fail("branches")
    );

    return () => {
      unsubBusiness();
      unsubPlans();
      unsubBranches();
    };
  }, [businessId]);

  // The logged-in staff member's own checkboxes (the owner does not need them)
  useEffect(() => {
    if (!businessId || !uid || !role || role === "owner") {
      setMyPermissions(null);
      setPermsLoaded(true);
      return;
    }

    setPermsLoaded(false);
    return onSnapshot(
      doc(db, "businesses", businessId, "staff", uid),
      (snap) => {
        const p = snap.exists() ? snap.data().permissions : undefined;
        setMyPermissions(Array.isArray(p) ? (p as string[]) : null);
        setPermsLoaded(true);
      },
      () => {
        // If it cannot be read, fall back to the role defaults
        setMyPermissions(null);
        setPermsLoaded(true);
      }
    );
  }, [businessId, uid, role]);

  // Remember the selected branch in this browser
  useEffect(() => {
    if (!businessId) return;
    try {
      setSavedBranch(localStorage.getItem(`gymos-branch-${businessId}`) ?? "all");
    } catch {
      /* storage not available */
    }
  }, [businessId]);

  const setBranchId = (id: string) => {
    setSavedBranch(id);
    try {
      localStorage.setItem(`gymos-branch-${businessId}`, id);
    } catch {
      /* storage not available */
    }
  };

  // If the saved branch was deleted, fall back to "all"
  const branchId =
    savedBranch === "all" || branches.some((b) => b.id === savedBranch)
      ? savedBranch
      : "all";

  const plan = useMemo(
    () => plans.find((p) => p.name === business?.plan) ?? null,
    [plans, business]
  );

  const loading =
    !!businessId && !(loaded.business && loaded.plans && loaded.branches && permsLoaded);

  return (
    <OwnerContext.Provider
      value={{
        businessId,
        business,
        plan,
        branches,
        branchId,
        setBranchId,
        myPermissions,
        loading,
        error,
      }}
    >
      {children}
    </OwnerContext.Provider>
  );
}
