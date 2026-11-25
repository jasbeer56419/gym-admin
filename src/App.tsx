import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Businesses from "./pages/Businesses";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SupportLogs from "./pages/SupportLogs";
import Layout from "./components/Layout";
import ProtectedRoute from "./ProtectedRoute";
import { OwnerProvider } from "./owner/OwnerContext";
import OwnerLayout from "./owner/OwnerLayout";

import HomePage from "./owner/pages/HomePage";
import Staff from "./owner/pages/Staff";
import Branches from "./owner/pages/Branches";
import Signup from "./pages/Signup";
import Members from "./owner/pages/Members";
import MemberDetail from "./owner/pages/MemberDetail";
import MembershipPlans from "./owner/pages/MembershipPlans";
import Billing from "./owner/pages/Billing";
import SettingsPage from "./owner/pages/BusinessSettings";
import Attendance from "./owner/pages/Attendance";
import Leads from "./owner/pages/Leads";
import OwnerReports from "./owner/pages/Reports";
import Classes from "./owner/pages/Classes";
import Notifications from "./owner/pages/Notifications";
import PersonalTraining from "./owner/pages/PersonalTraining";

import Inventory from "./owner/pages/Inventory";
import ProductDetail from "./owner/pages/ProductDetail";
import EquipmentDetail from "./owner/pages/EquipmentDetail";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <Routes>
      {/* PUBLIC pages: the landing page is the first thing visitors see */}
      <Route path="/" element={<Landing />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Super Admin panel */}
      <Route
        element={
          <ProtectedRoute allow={["super_admin"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/businesses" element={<Businesses />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/support" element={<SupportLogs />} />
      </Route>

      {/* Gym Owner portal */}
      <Route
        element={
          <ProtectedRoute allow={["owner", "manager", "receptionist", "trainer"]}>
            <OwnerProvider>
              <OwnerLayout />
            </OwnerProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/app" element={<HomePage />} />
        <Route path="/app/branches" element={<Branches />} />
        <Route path="/app/members" element={<Members />} />
        <Route path="/app/members/:id" element={<MemberDetail />} />
        <Route path="/app/memberships" element={<MembershipPlans />} />
        <Route path="/app/billing" element={<Billing />} />
        <Route path="/app/settings" element={<SettingsPage />} />
        <Route path="/app/attendance" element={<Attendance />} />
        <Route path="/app/staff" element={<Staff />} />
        <Route path="/app/leads" element={<Leads />} />
        <Route path="/app/reports" element={<OwnerReports />} />
        <Route path="/app/classes" element={<Classes />} />
        <Route path="/app/notifications" element={<Notifications />} />
        <Route path="/app/training" element={<PersonalTraining />} />
        <Route path="/app/inventory" element={<Inventory />} />
        <Route path="/app/inventory/products/:id" element={<ProductDetail />} />
        <Route path="/app/inventory/equipment/:id" element={<EquipmentDetail />} />
      </Route>

      {/* Any unknown URL goes to the landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
