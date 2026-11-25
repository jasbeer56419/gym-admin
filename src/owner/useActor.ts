import { useAuth } from "../AuthContext";

// Who is logged in right now (saved on every payment they collect)
export function useActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid ?? "",
    name: profile?.name || user?.email || "Staff",
    role: profile?.role ?? "",
  };
}