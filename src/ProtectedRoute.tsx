import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Denied({ text, onLogout }: { text: string; onLogout: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-10 text-center">
        <h2 className="font-display text-2xl">Access Denied</h2>
        <p className="mt-3 text-sm text-muted">{text}</p>
        <button onClick={onLogout} className="btn-gold mt-6 px-6 py-2.5">
          Log out
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: string[];
  children: ReactNode;
}) {
  const { user, role, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <Denied
        text="Your account is not set up or has been disabled. Please contact the platform administrator."
        onLogout={logout}
      />
    );
  }

  if (!allow.includes(role)) {
   
    if (role === "super_admin") return <Navigate to="/dashboard" replace />;
  
        if (["owner", "manager", "receptionist", "trainer"].includes(role)) {
      return <Navigate to="/app" replace />;
    }
    return (
      <Denied text="Your role does not have a portal yet." onLogout={logout} />
    );
  }

  return <>{children}</>;
}
