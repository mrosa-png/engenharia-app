'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single()

    if (!profile) {
      setError('Perfil não encontrado. Contate o administrador.')
      setLoading(false)
      return
    }

    router.push(profile.role === 'encarregado' ? '/form' : '/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">

      {/* Topo decorativo sutil */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #0d7070, #2bc4c4)' }} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <Image
              src="/logo.png"
              alt="Nexxus Engenharia e Consultoria"
              width={220}
              height={68}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-gray-300" />
            <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Indicadores</span>
            <div className="h-px w-8 bg-gray-300" />
          </div>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-700 mb-5">Acesse sua conta</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email" className="input" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <input
                type="password" className="input" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-1"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Problemas de acesso? Contate o administrador.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Nexxus Engenharia e Consultoria
        </p>
      </div>
    </div>
  )
}
