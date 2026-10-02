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

export const TEAM_SUPERVISORS = [
  { id: "demo-supervisor", fullName: "Andrés Ríos", email: "supervisor@limpiapp.co" },
  { id: "demo-supervisor-2", fullName: "Camila Torres", email: "camila.torres@limpiapp.co" },
] as const;

export const COORDINATOR_PROFILE = {
  id: "demo-coordinador",
  fullName: "Marta Delgado",
  email: "coordinador@limpiapp.co",
  phone: "601 555 0144",
  title: "Coordinadora de operaciones",
  zone: "Bogotá · Cundinamarca",
  shift: "Lunes a sábado · 6:00–18:00",
  costCenters: ["Planta Bogotá Norte", "Sede Chapinero", "Club Autopista Norte"],
};

export function seedUserById(id: string) {
  return SEED_USERS.find((user) => user.id === id) ?? null;
}

export function seedName(id: string | null | undefined, role?: UserRole) {
  const user = id ? seedUserById(id) : null;
  if (user) return user.fullName;
  const teammate = TEAM_SUPERVISORS.find((item) => item.id === id);
  if (teammate) return teammate.fullName;
  if (role === "supervisor") return "Supervisor";
  return "";
}
