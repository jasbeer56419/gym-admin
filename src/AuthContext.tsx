import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Profile = {
  name: string;
  role: string;
  businessId: string | null;
  businessName: string;
};

type AuthState = {
  user: User | null;
  profile: Profile | null;
  role: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>(null as unknown as AuthState);

export const useAuth = () => useContext(AuthContext);

async function fetchProfile(uid: string): Promise<Profile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const d = snap.exists() ? snap.data() : null;
    if (!d || d.status === "disabled") return null;
    return {
      name: d.name ?? "",
      role: d.role as string,
      businessId: d.businessId ?? null,
      businessName: d.businessName ?? "",
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Makes sure an older, slower request can never overwrite a newer one
  const seq = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        seq.current++;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setUser(u);
      const mine = ++seq.current;
      const p = await fetchProfile(u.uid);
      if (mine === seq.current) {
        setProfile(p);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    const u = auth.currentUser;
    if (!u) return;
    const mine = ++seq.current;
    const p = await fetchProfile(u.uid);
    if (mine === seq.current) {
      setProfile(p);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
