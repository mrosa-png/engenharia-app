import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/orders/[id] — busca uma OS completa
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('service_orders')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 })
  }

  const [photosRes, unitRes, empRes, collabRes] = await Promise.all([
    admin.from('photos').select('*').eq('service_order_id', params.id),
    admin.from('units').select('id, name').eq('id', data.unit_id).single(),
    data.responsible_id
      ? admin.from('employees').select('id, name').eq('id', data.responsible_id).single()
      : Promise.resolve({ data: null }),
    admin.from('service_order_collaborators')
      .select('employee_id, employees(id, name)')
      .eq('service_order_id', params.id),
  ])

  return NextResponse.json({
    ...data,
    units: unitRes.data,
    employees: (empRes as any).data,
    photos: photosRes.data || [],
    service_order_collaborators: collabRes.data || [],
  })
}

// PATCH /api/orders/[id] — atualiza campos de uma OS
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = supabaseAdmin()
  const body = await req.json()

  // Campos permitidos para atualização
  const allowed = [
    'end_time', 'status', 'priority', 'detailed_service_type',
    'sector_id', 'description', 'epi_used', 'activity_type', 'service_type',
  ]
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('service_orders')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
