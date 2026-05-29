import { auth } from "@/auth"
import DashboardClient from "./dashboard-client"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/medico/login")
    }

    const medicoData = {
        id: session.user.id || "",
        nombre: session.user.name || "Médico",
        email: session.user.email || "",
        consultorio: "Consultorio Principal",
    }

    return <DashboardClient initialMedico={medicoData} />
}
