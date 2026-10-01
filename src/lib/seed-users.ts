import type { SessionUser, UserRole } from "./types";

export const DEMO_PASSWORD = "LimpiApp2026";

export const SEED_USERS: SessionUser[] = [
  {
    id: "demo-cliente",
    email: "cliente@limpiapp.co",
    fullName: "Laura Méndez",
    role: "cliente",
    demo: true,
  },
  {
    id: "demo-supervisor",
    email: "supervisor@limpiapp.co",
    fullName: "Andrés Ríos",
    role: "supervisor",
    demo: true,
  },
  {
    id: "demo-coordinador",
    email: "coordinador@limpiapp.co",
    fullName: "Marta Delgado",
    role: "coordinador",
    demo: true,
  },
];

export function authenticateSeed(email: string, password: string): SessionUser | null {
  if (password !== DEMO_PASSWORD) return null;
  const normalized = email.trim().toLowerCase();
  return SEED_USERS.find((user) => user.email === normalized) ?? null;
}

export function seedUserById(id: string) {
  return SEED_USERS.find((user) => user.id === id) ?? null;
}

export function seedName(id: string | null | undefined, role?: UserRole) {
  const user = id ? seedUserById(id) : null;
  if (user) return user.fullName;
  if (role === "supervisor") return "Supervisor";
  return "";
}
