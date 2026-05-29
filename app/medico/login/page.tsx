"use client"

import type React from "react"

import { useFormState, useFormStatus } from "react-dom"
import { authenticate } from "@/app/lib/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

function LoginButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Iniciando sesión..." : "Iniciar Sesión"}
    </Button>
  )
}

export default function MedicoLogin() {
  const [errorMessage, dispatch] = useFormState(authenticate, undefined)



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Acceso Médicos</CardTitle>
          <CardDescription>Ingrese sus credenciales para acceder al panel de control</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="medico@ejemplo.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription>
                <strong>Demo:</strong> medico@demo.com / demo123 (Auto-generado)
              </AlertDescription>
            </Alert>

            <LoginButton />
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tiene cuenta?{" "}
              <Link href="/medico/registro" className="text-blue-600 hover:underline">
                Registrarse aquí
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
