import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Validation schema for login
const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" }, // Optimized for performance and simple credential auth
    providers: [
        Credentials({
            async authorize(credentials) {
                const validatedFields = LoginSchema.safeParse(credentials)

                if (validatedFields.success) {
                    const { email, password } = validatedFields.data

                    let user = await prisma.user.findUnique({ where: { email } })

                    // --- AUTO-SEEDING FOR DEV/MVP ---
                    // Creates the default doctor user if it doesn't exist
                    if (!user && email === 'medico@demo.com') {
                        const hashedPassword = await bcrypt.hash('demo123', 10)
                        user = await prisma.user.create({
                            data: {
                                email,
                                password: hashedPassword,
                                name: 'Dr. Juan Pérez',
                                role: 'MEDICO',
                                medicoProfile: {
                                    create: {
                                        ruc: '1790011223001',
                                        establecimiento: '001',
                                        puntoEmision: '001'
                                    }
                                }
                            }
                        })
                    }
                    // --------------------------------

                    if (!user || !user.password) return null

                    const passwordsMatch = await bcrypt.compare(password, user.password)
                    if (passwordsMatch) return user
                }
                return null
            },
        }),
    ],
})
