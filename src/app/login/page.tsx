import { redirect } from "next/navigation";

/** La selección de roles en página dedicada se eliminó: el acceso es desde el inicio. */
export default function LoginRedirectPage() {
  redirect("/?login=1");
}
