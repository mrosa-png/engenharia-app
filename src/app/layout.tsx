import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ordens de Serviço — Guandu',
  description: 'Sistema de registro de ordens de serviço',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
