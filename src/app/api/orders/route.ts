import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  const unitId = searchParams.get('unit')
  const sectorId = searchParams.get('sector')

  const admin = supabaseAdmin()

  let query = admin
    .from('service_orders')
    .select('*')
    .order('activity_date', { ascending: false })

  if (dateFrom) query = query.gte('activity_date', dateFrom)
  if (dateTo) query = query.lte('activity_date', dateTo)
  if (unitId && unitId !== 'all') query = query.eq('unit_id', unitId)
  if (sectorId && sectorId !== 'all') query = query.eq('sector_id', sectorId)

  const { data: orders, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orders || orders.length === 0) return NextResponse.json([])

  const orderIds = orders.map(o => o.id)
  const responsibleIds = orders.map(o => o.responsible_id).filter(Boolean)
  const sectorIds = Array.from(new Set(orders.map(o => o.sector_id).filter(Boolean)))

  const [photosRes, unitsRes, empsRes, sectorsRes] = await Promise.all([
    admin.from('photos').select('*').in('service_order_id', orderIds),
    admin.from('units').select('id, name'),
    responsibleIds.length > 0
      ? admin.from('employees').select('id, name').in('id', responsibleIds)
      : Promise.resolve({ data: [] }),
    sectorIds.length > 0
      ? admin.from('sectors').select('id, name').in('id', sectorIds)
      : Promise.resolve({ data: [] }),
  ])

  const unitsMap: Record<string, string> = {}
  ;(unitsRes.data || []).forEach((u: any) => { unitsMap[u.id] = u.name })

  const empMap: Record<string, string> = {}
  ;((empsRes as any).data || []).forEach((e: any) => { empMap[e.id] = e.name })

  const sectorMap: Record<string, string> = {}
  ;((sectorsRes as any).data || []).forEach((s: any) => { sectorMap[s.id] = s.name })

  const enriched = orders.map(o => ({
    ...o,
    units: { name: unitsMap[o.unit_id] || '—' },
    employees: o.responsible_id ? { name: empMap[o.responsible_id] || '—' } : null,
    sectors: o.sector_id ? { name: sectorMap[o.sector_id] || '—' } : null,
    photos: (photosRes.data || []).filter((p: any) => p.service_order_id === o.id),
  }))

  return NextResponse.json(enriched)
}
