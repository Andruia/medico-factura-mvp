import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: "/medico/login", // Default login page, redirection logic handles the rest
        error: "/medico/login", // Error code passed in url query string as ?error=
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const userRole = auth?.user?.role
            
            const isOnMedicoDashboard = nextUrl.pathname.startsWith("/medico/dashboard")
            const isOnFacturadorDashboard = nextUrl.pathname.startsWith("/facturador/dashboard")
            const isOnLogin = nextUrl.pathname.startsWith("/medico/login") || nextUrl.pathname.startsWith("/facturador/login")

            // Logic for Dashboard Access
            if (isOnMedicoDashboard) {
                if (isLoggedIn && userRole === 'MEDICO') return true
                return false // Redirect unauthenticated or wrong role
            }

            if (isOnFacturadorDashboard) {
                if (isLoggedIn && userRole === 'FACTURADOR') return true
                return false
            }

            // Logic for Login Pages
            if (isOnLogin) {
                if (isLoggedIn) {
                    if (userRole === 'MEDICO') {
                        return Response.redirect(new URL("/medico/dashboard", nextUrl))
                    } else if (userRole === 'FACTURADOR') {
                        return Response.redirect(new URL("/facturador/dashboard", nextUrl))
                    }
                }
                return true
            }
            
            // Allow public access to landing page and other routes by default
            return true
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            if (token.role && session.user) {
                session.user.role = token.role as "ADMIN" | "MEDICO" | "FACTURADOR"
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role
            }
            return token
        }
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig
