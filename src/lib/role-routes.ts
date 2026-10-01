import type { UserRole } from "./types";

export function roleHomePath(role: UserRole): string {
  return `/${role}`;
}
