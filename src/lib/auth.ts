import { useEffect, useState } from "react";

export type UserRole = "admin" | "superadmin";

export interface CurrentUser {
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: string;
}

const STORAGE_KEY = "hostline.currentUser";
const EVENT = "hostline.auth.changed";

function readUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

function writeUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function signIn(email: string, _password: string): CurrentUser {
  // Mock: emails containing "staff" or "@hostline" log in as superadmin.
  const role: UserRole =
    /staff|@hostline|admin@hostline/i.test(email) ? "superadmin" : "admin";
  const name =
    role === "superadmin"
      ? "HostLine Staff"
      : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Restaurant Owner";
  const user: CurrentUser = { email, name, role, restaurantId: "olive-ember" };
  writeUser(user);
  return user;
}

export function signOut() {
  writeUser(null);
}

export function setRole(role: UserRole) {
  const u = readUser();
  if (!u) {
    writeUser({
      email: role === "superadmin" ? "staff@hostline.ai" : "maria@oliveandember.com",
      name: role === "superadmin" ? "HostLine Staff" : "Maria Lombardi",
      role,
      restaurantId: "olive-ember",
    });
  } else {
    writeUser({ ...u, role });
  }
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(() => readUser());
  useEffect(() => {
    const handler = () => setUser(readUser());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return user;
}
