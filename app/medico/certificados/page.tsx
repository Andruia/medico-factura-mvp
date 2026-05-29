import { auth } from "@/auth"
import { redirect } from "next/navigation"
import CertificadosClient from "./certificados-client"

export default async function GestionCertificadosPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/medico/login")
  }

  // Pass the user session data to the client component
  // We need to ensure the ID is present, which standard NextAuth session usually provides
  return <CertificadosClient initialMedico={session.user} />
}
