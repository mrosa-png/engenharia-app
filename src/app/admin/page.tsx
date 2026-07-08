'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Profile, Employee, Unit, Sector } from '@/lib/types'
import Image from 'next/image'

type Tab = 'employees' | 'users' | 'units' | 'sectors'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('employees')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [units, setUnits] = useState<Unit[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])

  const [newEmployee, setNewEmployee] = useState({ name: '', unit_id: '' })
  const [newUnit, setNewUnit] = useState('')
  const [newSector, setNewSector] = useState({ name: '', unit_id: '' })
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'encarregado', unit_id: '', password: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Para expandir setores por unidade
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*, units(*)').eq('id', user.id).single()
      if (!prof || prof.role !== 'super_admin') { router.push('/dashboard'); return }
      setProfile(prof)
      await Promise.all([fetchUnits(), fetchEmployees(), fetchUsers(), fetchSectors()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchUnits() {
    const { data } = await supabase.from('units').select('*').order('name')
    setUnits(data || [])
  }
  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('*, units(name)').order('name')
    setEmployees(data || [])
  }
  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*, units(name)').order('full_name')
    setUsers(data || [])
  }
  async function fetchSectors() {
    const { data } = await supabase.from('sectors').select('*, units(name)').order('name')
    setSectors(data || [])
  }

  function flash(ok: boolean, text: string) {
    if (ok) { setMsg(text); setErr('') } else { setErr(text); setMsg('') }
    setTimeout(() => { setMsg(''); setErr('') }, 4000)
  }

  // ── Employees ──
  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('employees').insert({ name: newEmployee.name.trim(), unit_id: newEmployee.unit_id })
    if (error) { flash(false, 'Erro ao adicionar funcionário.'); return }
    flash(true, 'Funcionário adicionado!')
    setNewEmployee({ name: '', unit_id: '' })
    fetchEmployees()
  }
  async function toggleEmployee(emp: Employee) {
    await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    fetchEmployees()
  }
  async function deleteEmployee(id: string) {
    if (!confirm('Remover funcionário?')) return
    await supabase.from('employees').delete().eq('id', id)
    fetchEmployees()
  }

  // ── Units ──
  async function addUnit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('units').insert({ name: newUnit.trim().toUpperCase() })
    if (error) { flash(false, 'Erro ao adicionar unidade.'); return }
    flash(true, 'Unidade criada!')
    setNewUnit('')
    fetchUnits()
  }
  async function toggleUnit(u: Unit) {
    await supabase.from('units').update({ active: !u.active }).eq('id', u.id)
    fetchUnits()
  }

  // ── Sectors ──
  async function addSector(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('sectors').insert({
      name: newSector.name.trim(),
      unit_id: newSector.unit_id,
    })
    if (error) { flash(false, 'Erro ao adicionar setor.'); return }
    flash(true, 'Setor adicionado!')
    setNewSector(p => ({ ...p, name: '' }))
    fetchSectors()
  }
  async function toggleSector(s: Sector) {
    await supabase.from('sectors').update({ active: !s.active }).eq('id', s.id)
    fetchSectors()
  }
  async function deleteSector(id: string) {
    if (!confirm('Remover setor?')) return
    await supabase.from('sectors').delete().eq('id', id)
    fetchSectors()
  }

  // ── Users ──
  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const json = await res.json()
    if (!res.ok) { flash(false, json.error || 'Erro ao criar usuário.'); return }
    flash(true, 'Usuário criado!')
    setNewUser({ email: '', full_name: '', role: 'encarregado', unit_id: '', password: '' })
    fetchUsers()
  }
  async function toggleUser(u: Profile) {
    await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id)
    fetchUsers()
  }

  const roleLabel: Record<string, string> = { super_admin: 'Super Admin', gestor: 'Gestor', encarregado: 'Encarregado' }
  const roleColor: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    gestor: 'bg-blue-100 text-blue-700',
    encarregado: 'bg-gray-100 text-gray-600',
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'employees', label: 'Funcionários' },
    { key: 'users', label: 'Usuários do Sistema' },
    { key: 'units', label: 'Unidades' },
    { key: 'sectors', label: 'Setores' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Nexxus" width={120} height={37} className="object-contain" />
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <span className="font-semibold text-sm" style={{ color: '#0d7070' }}>Nexxus Indicadores</span>
            <p className="text-gray-400 text-xs">{profile?.full_name} · Administração</p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Dashboard
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{msg}</div>}
        {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{err}</div>}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t.key ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              style={tab === t.key ? { color: '#0d7070' } : {}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── FUNCIONÁRIOS ── */}
        {tab === 'employees' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Adicionar Funcionário</h2>
              <form onSubmit={addEmployee} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Nome completo</label>
                  <input className="input" placeholder="Ex: João da Silva" value={newEmployee.name}
                    onChange={e => setNewEmployee(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="w-48">
                  <label className="label">Unidade</label>
                  <select className="input" value={newEmployee.unit_id}
                    onChange={e => setNewEmployee(p => ({ ...p, unit_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary">Adicionar</button>
              </form>
            </div>
            <div className="card overflow-hidden">
              <h2 className="font-semibold text-gray-700 mb-4">Funcionários Cadastrados</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Nome</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Unidade</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{emp.name}</td>
                      <td className="px-3 py-2 text-gray-500">{(emp as any).units?.name}</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {emp.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2 flex gap-3 justify-end">
                        <button onClick={() => toggleEmployee(emp)} className="text-xs text-blue-600 hover:underline">
                          {emp.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onClick={() => deleteEmployee(emp.id)} className="text-xs text-red-500 hover:underline">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Nenhum funcionário cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USUÁRIOS ── */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Criar Usuário do Sistema</h2>
              <form onSubmit={addUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nome completo</label>
                    <input className="input" placeholder="Nome" value={newUser.full_name}
                      onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input type="email" className="input" placeholder="email@exemplo.com" value={newUser.email}
                      onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Senha inicial</label>
                    <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={newUser.password}
                      onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required minLength={6} />
                  </div>
                  <div>
                    <label className="label">Perfil</label>
                    <select className="input" value={newUser.role}
                      onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                      <option value="encarregado">Encarregado</option>
                      <option value="gestor">Gestor</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Unidade</label>
                    <select className="input" value={newUser.unit_id}
                      onChange={e => setNewUser(p => ({ ...p, unit_id: e.target.value }))}>
                      <option value="">Sem unidade específica</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary">Criar Usuário</button>
              </form>
            </div>
            <div className="card overflow-hidden">
              <h2 className="font-semibold text-gray-700 mb-4">Usuários Cadastrados</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Nome</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Unidade</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Perfil</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{u.full_name}</td>
                      <td className="px-3 py-2 text-gray-500">{(u as any).units?.name || '—'}</td>
                      <td className="px-3 py-2"><span className={`badge ${roleColor[u.role]}`}>{roleLabel[u.role]}</span></td>
                      <td className="px-3 py-2">
                        <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => toggleUser(u)} className="text-xs text-blue-600 hover:underline">
                          {u.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nenhum usuário.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── UNIDADES ── */}
        {tab === 'units' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Adicionar Unidade</h2>
              <form onSubmit={addUnit} className="flex gap-3">
                <input className="input flex-1" placeholder="Ex: ETA GUANDU" value={newUnit}
                  onChange={e => setNewUnit(e.target.value)} required />
                <button type="submit" className="btn-primary">Adicionar</button>
              </form>
            </div>
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Unidades Cadastradas</h2>
              <div className="space-y-2">
                {units.map(u => {
                  const unitSectors = sectors.filter(s => s.unit_id === u.id)
                  return (
                    <div key={u.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}
                            className="text-gray-400 hover:text-gray-600 text-sm">
                            {expandedUnit === u.id ? '▼' : '▶'}
                          </button>
                          <span className="font-medium text-sm">{u.name}</span>
                          <span className="text-xs text-gray-400">{unitSectors.length} setor{unitSectors.length !== 1 ? 'es' : ''}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.active ? 'Ativa' : 'Inativa'}
                          </span>
                          <button onClick={() => toggleUnit(u)} className="text-xs text-blue-600 hover:underline">
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </div>
                      {expandedUnit === u.id && (
                        <div className="p-3 bg-white border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Setores</p>
                          {unitSectors.length === 0
                            ? <p className="text-xs text-gray-400 italic">Nenhum setor cadastrado nesta unidade.</p>
                            : <div className="space-y-1">
                              {unitSectors.map(s => (
                                <div key={s.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
                                  <span className="text-sm">{s.name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className={`badge text-xs ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                      {s.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <button onClick={() => toggleSector(s)} className="text-xs text-blue-600 hover:underline">
                                      {s.active ? 'Desativar' : 'Ativar'}
                                    </button>
                                    <button onClick={() => deleteSector(s.id)} className="text-xs text-red-500 hover:underline">
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
                {units.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Nenhuma unidade cadastrada.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SETORES ── */}
        {tab === 'sectors' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Adicionar Setor</h2>
              <form onSubmit={addSector} className="flex flex-wrap gap-3 items-end">
                <div className="w-52">
                  <label className="label">Unidade</label>
                  <select className="input" value={newSector.unit_id}
                    onChange={e => setNewSector(p => ({ ...p, unit_id: e.target.value }))} required>
                    <option value="">Selecione a unidade...</option>
                    {units.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Nome do Setor</label>
                  <input className="input" placeholder="Ex: Galeria de Bombas" value={newSector.name}
                    onChange={e => setNewSector(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <button type="submit" className="btn-primary">Adicionar</button>
              </form>
            </div>

            {/* Setores agrupados por unidade */}
            <div className="space-y-4">
              {units.map(u => {
                const unitSectors = sectors.filter(s => s.unit_id === u.id)
                if (unitSectors.length === 0) return null
                return (
                  <div key={u.id} className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#0d7070' }} />
                      <h3 className="font-semibold text-gray-700">{u.name}</h3>
                      <span className="text-xs text-gray-400">{unitSectors.length} setor{unitSectors.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div className="space-y-1">
                      {unitSectors.map(s => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 border border-gray-50">
                          <span className="text-sm font-medium">{s.name}</span>
                          <div className="flex items-center gap-3">
                            <span className={`badge ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {s.active ? 'Ativo' : 'Inativo'}
                            </span>
                            <button onClick={() => toggleSector(s)} className="text-xs text-blue-600 hover:underline">
                              {s.active ? 'Desativar' : 'Ativar'}
                            </button>
                            <button onClick={() => deleteSector(s.id)} className="text-xs text-red-500 hover:underline">
                              Remover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {sectors.length === 0 && (
                <div className="card text-center text-gray-400 py-8">
                  Nenhum setor cadastrado ainda. Adicione o primeiro acima.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
