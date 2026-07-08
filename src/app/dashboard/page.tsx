'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ServiceOrder, Profile } from '@/lib/types'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ComposedChart, Area,
} from 'recharts'
import { OS_STATUSES } from '@/lib/types'
import Image from 'next/image'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899']

// Calculates hours from start_time / end_time strings like "07:30" / "12:00"
function calcHours(start: string, end?: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - sh * 60 - sm
  return Math.max(0, Math.round((mins / 60) * 10) / 10)
}

function fmt(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium opacity-60 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name}: <strong>{typeof p.value === 'number' ? fmt(p.value) : p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

type Tab = 'dashboard' | 'dados' | 'indicadores'

// ── Modal de fotos por fase ──────────────────────────────────────────────────
function PhotoModal({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const phases = [
    { key: 'antes',   label: '🟢 Início do Serviço' },
    { key: 'durante', label: '🔵 Em Execução' },
    { key: 'depois',  label: '✅ Finalização' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">Fotos da OS</p>
            <p className="text-xs text-gray-400">
              {order.units?.name} · {new Date(order.activity_date + 'T00:00:00').toLocaleDateString('pt-BR')} · {order.service_type}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-4 space-y-5">
          {phases.map(({ key, label }) => {
            const phasPhotos = (order.photos || []).filter((p: any) => p.photo_type === key)
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-sm text-gray-700">{label}</p>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{phasPhotos.length} foto{phasPhotos.length !== 1 ? 's' : ''}</span>
                </div>
                {phasPhotos.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">Nenhuma foto registrada nesta fase.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {phasPhotos.map((p: any, i: number) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="block rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition-shadow" style={{ aspectRatio: '1' }}>
                        <img src={p.url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterUnit, setFilterUnit] = useState('all')
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [searchDados, setSearchDados] = useState('')
  const [photoOrder, setPhotoOrder] = useState<ServiceOrder | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*, units(*)')
        .eq('id', user.id)
        .single()

      if (!prof || prof.role === 'encarregado') {
        router.push('/form')
        return
      }
      setProfile(prof)

      const { data: unitList } = await supabase.from('units').select('id, name').eq('active', true)
      setUnits(unitList || [])

      await fetchOrders()
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchOrders() {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (filterUnit !== 'all') params.set('unit', filterUnit)

    const res = await fetch(`/api/orders?${params.toString()}`)
    if (!res.ok) { setOrders([]); return }
    const data = await res.json()
    setOrders(data || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ─── Computed analytics ───────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalOS = orders.length
    const totalHoras = orders.reduce((acc, o) => acc + calcHours(o.start_time, o.end_time), 0)
    const mediaHoras = totalOS ? totalHoras / totalOS : 0
    const epiOk = orders.filter(o => o.epi_used).length
    const epiPct = totalOS ? Math.round((epiOk / totalOS) * 100) : 0

    const diasSet = new Set(orders.map(o => o.activity_date))
    const diasAtivos = diasSet.size
    const mediaPorDia = diasAtivos ? totalOS / diasAtivos : 0

    // By service_type (Disciplina)
    const byDisciplina = Object.entries(
      orders.reduce((acc, o) => {
        if (!acc[o.service_type]) acc[o.service_type] = { os: 0, horas: 0 }
        acc[o.service_type].os++
        acc[o.service_type].horas += calcHours(o.start_time, o.end_time)
        return acc
      }, {} as Record<string, { os: number; horas: number }>)
    )
      .map(([name, v]) => ({ name, os: v.os, horas: Math.round(v.horas * 10) / 10 }))
      .sort((a, b) => b.os - a.os)

    // By responsible (Equipe)
    const byEquipe = Object.entries(
      orders.reduce((acc, o) => {
        const nome = o.employees?.name || 'Sem responsável'
        if (!acc[nome]) acc[nome] = { os: 0, horas: 0 }
        acc[nome].os++
        acc[nome].horas += calcHours(o.start_time, o.end_time)
        return acc
      }, {} as Record<string, { os: number; horas: number }>)
    )
      .map(([name, v]) => ({ name, os: v.os, horas: Math.round(v.horas * 10) / 10 }))
      .sort((a, b) => b.os - a.os)

    // By activity_type (Tipo de Atividade)
    const byAtividade = Object.entries(
      orders.reduce((acc, o) => { acc[o.activity_type] = (acc[o.activity_type] || 0) + 1; return acc }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // By day (timeline)
    const byDay = Object.entries(
      orders.reduce((acc, o) => {
        const d = o.activity_date
        if (!acc[d]) acc[d] = { os: 0, horas: 0 }
        acc[d].os++
        acc[d].horas += calcHours(o.start_time, o.end_time)
        return acc
      }, {} as Record<string, { os: number; horas: number }>)
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        os: v.os,
        horas: Math.round(v.horas * 10) / 10,
      }))

    // Top days
    const topDias = [...byDay].sort((a, b) => b.os - a.os).slice(0, 10)

    return {
      totalOS, totalHoras: Math.round(totalHoras * 10) / 10, mediaHoras: Math.round(mediaHoras * 10) / 10,
      epiOk, epiPct, diasAtivos, mediaPorDia: Math.round(mediaPorDia * 100) / 100,
      byDisciplina, byEquipe, byAtividade, byDay, topDias,
    }
  }, [orders])

  // ─── Filtered table data ──────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    if (!searchDados) return orders
    const q = searchDados.toLowerCase()
    return orders.filter(o =>
      (o.units?.name || '').toLowerCase().includes(q) ||
      o.service_type.toLowerCase().includes(q) ||
      o.activity_type.toLowerCase().includes(q) ||
      (o.employees?.name || '').toLowerCase().includes(q) ||
      (o.description || '').toLowerCase().includes(q)
    )
  }, [orders, searchDados])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'dados', label: '📋 Base de Dados' },
    { key: 'indicadores', label: '🏆 Indicadores' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Nexxus" width={120} height={37} className="object-contain" />
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <span className="font-semibold text-sm" style={{ color: '#0d7070' }}>Nexxus Indicadores</span>
            <p className="text-gray-400 text-xs">{profile?.full_name} · {profile?.role === 'super_admin' ? 'Super Admin' : 'Gestor'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/form')}
            className="btn-primary text-sm px-3 py-1.5">
            + Nova OS
          </button>
          {profile?.role === 'super_admin' && (
            <button onClick={() => router.push('/admin')}
              className="btn-secondary text-sm px-3 py-1.5">
              Administração
            </button>
          )}
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-sm">Sair</button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">De</label>
            <input type="date" className="input w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Até</label>
            <input type="date" className="input w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {profile?.role === 'super_admin' && (
            <div>
              <label className="label">Unidade</label>
              <select className="input w-44" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                <option value="all">Todas</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn-primary" onClick={fetchOrders}>Filtrar</button>
          <button className="btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setFilterUnit('all') }}>
            Limpar
          </button>
          <span className="text-sm text-gray-400 ml-auto self-center">{analytics.totalOS} OS encontradas</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 text-teal-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
              style={activeTab === t.key ? { borderBottomColor: '#0d7070', color: '#0d7070' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ════════ TAB 1: DASHBOARD ════════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Total de OS" value={analytics.totalOS} color="blue" />
              <StatCard label="Horas Trabalhadas" value={fmt(analytics.totalHoras)} sub="total" color="cyan" />
              <StatCard label="Média h/OS" value={fmt(analytics.mediaHoras)} color="amber" />
              <StatCard label="Dias Ativos" value={analytics.diasAtivos} color="purple" />
              <StatCard label="OS por Dia" value={fmt(analytics.mediaPorDia)} color="green" />
              <StatCard label="EPI Utilizado" value={`${analytics.epiPct}%`} sub={`${analytics.epiOk} de ${analytics.totalOS}`} color={analytics.epiPct >= 80 ? 'green' : 'red'} />
            </div>

            {/* Row 1: Disciplina + Tipo de Atividade */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* OS e Horas por Disciplina */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">OS e Horas por Disciplina</h2>
                {analytics.byDisciplina.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(280, analytics.byDisciplina.length * 40)}>
                    <BarChart data={analytics.byDisciplina} layout="vertical" margin={{ left: 8, right: 60, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Bar dataKey="os" name="OS" fill="#3b82f6" radius={[0, 3, 3, 0]} barSize={12} />
                      <Bar dataKey="horas" name="Horas" fill="#10b981" radius={[0, 3, 3, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                  Compara quantidade de OS e horas totais por tipo de serviço (disciplina). Identifica qual área concentra mais demanda e esforço.
                </p>
              </div>

              {/* Tipo de Atividade - Pie */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">OS por Tipo de Atividade</h2>
                {analytics.byAtividade.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={analytics.byAtividade}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="42%"
                        outerRadius={95}
                      >
                        {analytics.byAtividade.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={48} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                  Proporção entre Corretiva, Preventiva, Melhoria e outros tipos. Ideal: maior fatia em Preventiva indica manutenção proativa.
                </p>
              </div>
            </div>

            {/* Row 2: Equipe */}
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">OS e Horas por Equipe / Responsável</h2>
              {analytics.byEquipe.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, analytics.byEquipe.length * 52 + 40)}>
                  <BarChart data={analytics.byEquipe} layout="vertical" margin={{ left: 8, right: 60, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar dataKey="os" name="OS" fill="#8b5cf6" radius={[0, 3, 3, 0]} barSize={14} />
                    <Bar dataKey="horas" name="Horas" fill="#f59e0b" radius={[0, 3, 3, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                Quantidade de OS e horas totais por responsável. Permite identificar sobrecarga de trabalho ou distribuição desigual entre equipes.
              </p>
            </div>

            {/* Row 3: Timeline */}
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Evolução Diária — OS e Horas</h2>
              {analytics.byDay.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={analytics.byDay} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="os" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="h" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Area yAxisId="h" type="monotone" dataKey="horas" name="Horas" fill="#bfdbfe" stroke="#3b82f6" strokeWidth={1.5} />
                    <Line yAxisId="os" type="monotone" dataKey="os" name="OS" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                Linha vermelha = número de OS por dia (eixo esquerdo). Área azul = horas trabalhadas (eixo direito). Picos indicam dias de maior demanda operacional.
              </p>
            </div>
          </>
        )}

        {/* ════════ TAB 2: BASE DE DADOS ════════ */}
        {activeTab === 'dados' && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Base de Dados — Ordens de Serviço</h2>
              <input
                type="text"
                placeholder="Buscar..."
                className="input w-56 text-sm"
                value={searchDados}
                onChange={e => setSearchDados(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-gray-600 font-semibold whitespace-nowrap">Data</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Status</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Prior.</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Unidade</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Disciplina</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Tipo Atividade</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Horário</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Horas</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Responsável</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">EPI</th>
                    <th className="px-3 py-2 text-gray-600 font-semibold">Fotos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-3 py-8 text-center text-gray-400">
                        {searchDados ? 'Nenhum resultado encontrado.' : 'Nenhuma OS no período selecionado.'}
                      </td>
                    </tr>
                  ) : filteredOrders.map(order => {
                    const h = calcHours(order.start_time, order.end_time)
                    const statusInfo = OS_STATUSES.find(s => s.value === order.status)
                    return (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-2 py-2">
                          <button
                            onClick={() => router.push(`/form?id=${order.id}`)}
                            className="text-xs font-medium whitespace-nowrap px-2 py-1 rounded transition-colors border"
                            style={{ color: '#0d7070', borderColor: '#0d7070', backgroundColor: 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0fafa')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            title="Editar OS"
                          >
                            ✏️ Editar
                          </button>
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {new Date(order.activity_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`badge whitespace-nowrap text-xs ${statusInfo?.color || 'bg-gray-100 text-gray-600'}`}>
                            {statusInfo?.label || order.status || 'ABERTA'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium whitespace-nowrap ${
                            order.priority === 'URGENTE' ? 'text-red-600' :
                            order.priority === 'PLANEJADA' ? 'text-purple-600' : 'text-gray-500'
                          }`}>{order.priority || 'ROTINA'}</span>
                        </td>
                        <td className="px-3 py-2 font-medium">{order.units?.name || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="badge bg-blue-100 text-blue-700 whitespace-nowrap">{order.service_type}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`badge whitespace-nowrap ${
                            order.activity_type === 'CORRETIVA' ? 'bg-red-100 text-red-700' :
                            order.activity_type === 'PREVENTIVA' ? 'bg-green-100 text-green-700' :
                            order.activity_type === 'MELHORIAS' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{order.activity_type}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {order.start_time}{order.end_time ? ` — ${order.end_time}` : <span className="text-amber-500 text-xs"> em aberto</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-medium">
                          {h > 0 ? fmt(h) + 'h' : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{order.employees?.name || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-xs truncate" title={order.description}>
                          {order.description || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`badge ${order.epi_used ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {order.epi_used ? 'SIM' : 'NÃO'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {(order.photos?.length || 0) > 0 ? (
                            <button
                              onClick={() => setPhotoOrder(order)}
                              className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                              style={{ color: '#0d7070', backgroundColor: '#f0fafa' }}
                              title="Ver fotos"
                            >
                              📷 {order.photos?.length}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredOrders.length > 0 && (
                <p className="text-xs text-gray-400 px-3 py-2 text-right">
                  {filteredOrders.length} registro{filteredOrders.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB 3: INDICADORES ════════ */}
        {activeTab === 'indicadores' && (
          <>
            {/* KPI summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Total de OS" value={analytics.totalOS} color="blue" />
              <StatCard label="Horas Totais" value={fmt(analytics.totalHoras)} color="cyan" />
              <StatCard label="Média h/OS" value={fmt(analytics.mediaHoras)} color="amber" />
              <StatCard label="Dias Ativos" value={analytics.diasAtivos} color="purple" />
              <StatCard label="Média OS/dia" value={fmt(analytics.mediaPorDia)} color="green" />
              <StatCard label="Equipes" value={analytics.byEquipe.length} color="blue" />
            </div>

            {/* Tables row */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Por Disciplina */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Por Disciplina (Tipo de Serviço)</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 text-gray-500 font-medium">Disciplina</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">OS</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byDisciplina.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-gray-400 text-center text-xs">Sem dados</td></tr>
                    ) : analytics.byDisciplina.map((d, i) => (
                      <tr key={d.name} className="border-b border-gray-50">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-xs">{d.name}</span>
                        </td>
                        <td className="py-2 text-right font-semibold">{d.os}</td>
                        <td className="py-2 text-right text-gray-500">{fmt(d.horas)}h</td>
                      </tr>
                    ))}
                    {analytics.byDisciplina.length > 0 && (
                      <tr className="font-bold text-blue-700">
                        <td className="pt-2 text-xs">TOTAL</td>
                        <td className="pt-2 text-right">{analytics.totalOS}</td>
                        <td className="pt-2 text-right">{fmt(analytics.totalHoras)}h</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Por Equipe */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Por Equipe / Responsável</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 text-gray-500 font-medium">Responsável</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">OS</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byEquipe.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-gray-400 text-center text-xs">Sem dados</td></tr>
                    ) : analytics.byEquipe.map((e, i) => (
                      <tr key={e.name} className="border-b border-gray-50">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-xs">{e.name}</span>
                        </td>
                        <td className="py-2 text-right font-semibold">{e.os}</td>
                        <td className="py-2 text-right text-gray-500">{fmt(e.horas)}h</td>
                      </tr>
                    ))}
                    {analytics.byEquipe.length > 0 && (
                      <tr className="font-bold text-purple-700">
                        <td className="pt-2 text-xs">TOTAL</td>
                        <td className="pt-2 text-right">{analytics.totalOS}</td>
                        <td className="pt-2 text-right">{fmt(analytics.totalHoras)}h</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top dias */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Top Dias com Mais OS</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 text-gray-500 font-medium">Data</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">OS</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topDias.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-gray-400 text-center text-xs">Sem dados</td></tr>
                    ) : analytics.topDias.map((d, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 font-medium text-xs">{d.date}</td>
                        <td className="py-2 text-right font-semibold">{d.os}</td>
                        <td className="py-2 text-right text-gray-500">{fmt(d.horas)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie por Disciplina */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">Distribuição por Disciplina</h2>
                {analytics.byDisciplina.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={analytics.byDisciplina} dataKey="os" nameKey="name" cx="50%" cy="40%" outerRadius={90}>
                        {analytics.byDisciplina.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={56} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                  Percentual de OS por disciplina. Fatias maiores indicam as áreas com maior volume de serviços no período.
                </p>
              </div>

              {/* Pie por Equipe */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-4">Distribuição por Equipe</h2>
                {analytics.byEquipe.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={analytics.byEquipe} dataKey="os" nameKey="name" cx="50%" cy="40%" outerRadius={90}>
                        {analytics.byEquipe.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={56} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                  Proporção de OS por responsável. Equilíbrio entre as fatias indica boa distribuição de carga de trabalho.
                </p>
              </div>
            </div>

            {/* Produtividade */}
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-2">Produtividade por Responsável</h2>
              {analytics.byEquipe.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, analytics.byEquipe.length * 44 + 40)}>
                  <BarChart
                    data={analytics.byEquipe.map(e => ({
                      name: e.name,
                      'h/OS': e.os > 0 ? Math.round((e.horas / e.os) * 10) / 10 : 0,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 60, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar dataKey="h/OS" name="Horas médias por OS" radius={[0, 4, 4, 0]} barSize={18}>
                      {analytics.byEquipe.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
                Média de horas gastas por ordem de serviço, por responsável. Valores altos podem indicar OS complexas ou necessidade de suporte adicional.
              </p>
            </div>

            {/* Análise gerencial */}
            <div className="card bg-blue-50 border border-blue-100">
              <h2 className="font-semibold text-blue-800 mb-3">📝 Análise Gerencial / Recomendações</h2>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>1. Acompanhe semanalmente as disciplinas com maior volume de horas para identificar gargalos e necessidades de redistribuição.</li>
                <li>2. Mantenha histórico mensal para comparação de produtividade, horas por OS e serviços por equipe.</li>
                <li>3. Separe OS corretivas, preventivas, melhorias e outros para medir melhor o desempenho operacional.</li>
                <li>4. Inclua prazo previsto e data de conclusão nas próximas OS para calcular cumprimento de prazo e pendências.</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Modal de visualização de fotos por fase */}
      {photoOrder && <PhotoModal order={photoOrder} onClose={() => setPhotoOrder(null)} />}
    </div>
  )
}
