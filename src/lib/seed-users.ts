import type { UserRole } from "./types";

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

export const SEED_USERS: SeedUser[] = [
  {
    id: "demo-cliente",
    email: "cliente@limpiapp.co",
    password: "LimpiApp2026",
    fullName: "Laura Méndez",
    role: "cliente",
  },
  {
    id: "demo-supervisor",
    email: "supervisor@limpiapp.co",
    password: "LimpiApp2026",
    fullName: "Andrés Ríos",
    role: "supervisor",
  },
  {
    id: "demo-coordinador",
    email: "coordinador@limpiapp.co",
    password: "LimpiApp2026",
    fullName: "Marta Delgado",
    role: "coordinador",
  },
];

export function findSeedByEmail(email: string) {
  const key = email.trim().toLowerCase();
  return SEED_USERS.find((user) => user.email === key) ?? null;
}

export function findSeedById(id: string) {
  return SEED_USERS.find((user) => user.id === id) ?? null;
}

export function authenticateSeed(email: string, password: string) {
  const user = findSeedByEmail(email);
  if (!user || user.password !== password) return null;
  return user;
}

export function publicSeedUser(user: SeedUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    demo: true as const,
  };
}
