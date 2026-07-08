import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email, password, full_name, role, unit_id } = await req.json()

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // 1. Cria o usuário no Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirma automaticamente
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Erro ao criar usuário.' }, { status: 400 })
  }

  // 2. Cria o perfil na tabela profiles
  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    full_name,
    role,
    unit_id: unit_id || null,
    active: true,
  })

  if (profileError) {
    // Desfaz criação do auth user em caso de erro no profile
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: authData.user.id })
}
