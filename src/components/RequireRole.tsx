import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser, type UserRole } from "@/lib/auth";

export function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === "superadmin" ? "/super" : "/app"} replace />;
  }
  return <>{children}</>;
}
