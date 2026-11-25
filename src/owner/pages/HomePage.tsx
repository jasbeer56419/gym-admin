import { useAuth } from "../../AuthContext";
import OwnerDashboard from "./OwnerDashboard";
import TrainerHome from "./TrainerHome";

export default function HomePage() {
  const { role } = useAuth();
  return role === "trainer" ? <TrainerHome /> : <OwnerDashboard />;
}