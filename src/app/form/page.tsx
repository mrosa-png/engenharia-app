'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ACTIVITY_TYPES, SERVICE_TYPES, DETAILED_SERVICE_TYPES,
  OS_STATUSES, OS_PRIORITIES,
  Employee, Profile, Unit, Sector, Photo, OSStatus, OSPriority,
} from '@/lib/types'
import Image from 'next/image'

type PhotoFiles = { antes: File[]; durante: File[]; depois: File[] }

function FormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id') // se presente, modo edição
  const isEdit = !!editId

  const [profile, setProfile] = useState<Profile | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [allSectors, setAllSectors] = useState<Sector[]>([])
  const [sectorId, setSectorId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([])
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

  // Campos do formulário
  const [activityType, setActivityType] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [detailedServiceType, setDetailedServiceType] = useState('')
  const [status, setStatus] = useState<OSStatus>('ABERTA')
  const [priority, setPriority] = useState<OSPriority>('ROTINA')
  const [activityDate, setActivityDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [epiUsed, setEpiUsed] = useState<boolean | null>(null)
  const [photos, setPhotos] = useState<PhotoFiles>({ antes: [], durante: [], depois: [] })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*, units(*)').eq('id', user.id).single()
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      // Carrega setores para todos os roles
      const { data: allSec } = await supabase.from('sectors').select('*').eq('active', true).order('name')
      setAllSectors(allSec || [])

      if (prof.role === 'encarregado') {
        setSelectedUnitId(prof.unit_id || '')
        const { data: emps } = await supabase
          .from('employees').select('*')
          .eq('unit_id', prof.unit_id).eq('active', true).order('name')
        setEmployees(emps || [])
        setSectors((allSec || []).filter(s => s.unit_id === prof.unit_id))
      } else {
        const { data: unitList } = await supabase.from('units').select('*').eq('active', true).order('name')
        setUnits(unitList || [])
        const { data: emps } = await supabase.from('employees').select('*').eq('active', true).order('name')
        setAllEmployees(emps || [])
      }

      // Modo edição: carrega OS existente
      if (editId) {
        const res = await fetch(`/api/orders/${editId}`)
        if (res.ok) {
          const os = await res.json()
          setActivityType(os.activity_type || '')
          setServiceType(os.service_type || '')
          setDetailedServiceType(os.detailed_service_type || '')
          setStatus(os.status || 'ABERTA')
          setPriority(os.priority || 'ROTINA')
          setActivityDate(os.activity_date || '')
          setStartTime(os.start_time || '')
          setEndTime(os.end_time || '')
          setDescription(os.description || '')
          setResponsibleId(os.responsible_id || '')
          setEpiUsed(os.epi_used ?? null)
          setSelectedUnitId(os.unit_id || '')
          setSectorId(os.sector_id || '')
          setExistingPhotos(os.photos || [])
          const collabIds = (os.service_order_collaborators || []).map((c: any) => c.employee_id)
          setCollaboratorIds(collabIds)
        }
      }

      setLoading(false)
    }
    load()
  }, [router, editId])

  // Filtra funcionários e setores quando unidade muda
  useEffect(() => {
    if (profile?.role !== 'encarregado' && selectedUnitId) {
      setEmployees(allEmployees.filter(e => e.unit_id === selectedUnitId))
      setSectors(allSectors.filter(s => s.unit_id === selectedUnitId))
      if (!isEdit) { setResponsibleId(''); setCollaboratorIds([]); setSectorId('') }
    }
  }, [selectedUnitId, allEmployees, allSectors, profile, isEdit])

  function toggleCollaborator(id: string) {
    setCollaboratorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handlePhotoChange(type: keyof PhotoFiles, files: FileList | null) {
    if (!files) return
    setPhotos(prev => ({ ...prev, [type]: Array.from(files).slice(0, 5) }))
  }

  async function uploadPhotos(orderId: string): Promise<string[]> {
    const types: (keyof PhotoFiles)[] = ['antes', 'durante', 'depois']
    const uploadErrors: string[] = []
    for (const type of types) {
      for (const file of photos[type]) {
        const ext = file.name.split('.').pop()
        const path = `${orderId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('os-photos').upload(path, file)
        if (upErr) {
          uploadErrors.push(`Foto "${file.name}" (${type}): ${upErr.message}`)
          continue
        }
        const { data: { publicUrl } } = supabase.storage.from('os-photos').getPublicUrl(path)
        const { error: dbErr } = await supabase.from('photos').insert({
          service_order_id: orderId,
          photo_type: type,
          storage_path: path,
          url: publicUrl,
        })
        if (dbErr) uploadErrors.push(`Registro foto "${file.name}": ${dbErr.message}`)
      }
    }
    return uploadErrors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (epiUsed === null) { setError('Informe se os EPIs estão sendo utilizados.'); return }
    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    if (isEdit && editId) {
      // ── Modo edição: PATCH ──────────────────────────────────────
      const res = await fetch(`/api/orders/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: activityType,
          service_type: serviceType,
          detailed_service_type: detailedServiceType || null,
          sector_id: sectorId || null,
          status,
          priority,
          end_time: endTime || null,
          description,
          epi_used: epiUsed,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao atualizar a OS.')
        setSubmitting(false)
        return
      }
      // Upload de novas fotos
      const editUploadErrors = await uploadPhotos(editId)
      if (editUploadErrors.length > 0) {
        setError(`OS salva, mas algumas fotos falharam:\n${editUploadErrors.join('\n')}`)
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } else {
      // ── Modo criação: INSERT ────────────────────────────────────
      const { data: order, error: orderErr } = await supabase
        .from('service_orders')
        .insert({
          unit_id: profile.role === 'encarregado' ? profile.unit_id : selectedUnitId,
          sector_id: sectorId || null,
          activity_type: activityType,
          service_type: serviceType,
          detailed_service_type: detailedServiceType || null,
          status,
          priority,
          activity_date: activityDate,
          start_time: startTime,
          end_time: endTime || null,
          description,
          responsible_id: responsibleId || null,
          epi_used: epiUsed,
          created_by: user.id,
        })
        .select().single()

      if (orderErr || !order) {
        setError('Erro ao salvar a ordem de serviço. Tente novamente.')
        setSubmitting(false)
        return
      }
      if (collaboratorIds.length > 0) {
        await supabase.from('service_order_collaborators').insert(
          collaboratorIds.map(eid => ({ service_order_id: order.id, employee_id: eid }))
        )
      }
      const createUploadErrors = await uploadPhotos(order.id)
      setCreatedOrderId(order.id)
      if (createUploadErrors.length > 0) {
        setError(`OS registrada, mas algumas fotos falharam:\n${createUploadErrors.join('\n')}`)
        setSubmitting(false)
        return
      }
      setSuccess(true)
    }
    setSubmitting(false)
  }

  function resetForm() {
    setActivityType(''); setServiceType(''); setDetailedServiceType('')
    setStatus('ABERTA'); setPriority('ROTINA')
    setActivityDate(''); setStartTime(''); setEndTime(''); setDescription('')
    setResponsibleId(''); setCollaboratorIds([]); setEpiUsed(null)
    setPhotos({ antes: [], durante: [], depois: [] })
    setExistingPhotos([])
    setSuccess(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>
  }

  // ── Tela de sucesso ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isEdit ? 'OS Atualizada!' : 'OS Registrada!'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {isEdit ? 'Ordem de serviço atualizada com sucesso.' : 'Ordem de serviço salva com sucesso.'}
          </p>
          <div className="flex flex-col gap-3">
            {!isEdit && createdOrderId && (
              <button
                className="w-full py-2 px-4 rounded-lg font-medium text-sm text-white"
                style={{ backgroundColor: '#0d7070' }}
                onClick={() => router.push(`/form?id=${createdOrderId}`)}
              >
                ✏️ Editar esta OS (adicionar fotos / encerrar)
              </button>
            )}
            {!isEdit && (
              <button className="btn-primary w-full" onClick={resetForm}>
                Registrar Nova OS
              </button>
            )}
            <button className="btn-secondary w-full" onClick={() => router.push('/dashboard')}>
              ← Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const photosByType = (type: PhotoType) => existingPhotos.filter(p => p.photo_type === type)

  // ── Formulário ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Nexxus" width={100} height={31} className="object-contain" />
          <div className="h-5 w-px bg-gray-200" />
          {(profile?.role === 'super_admin' || profile?.role === 'gestor') && (
            <button onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Dashboard
            </button>
          )}
          <div>
            <span className="font-semibold text-sm" style={{ color: '#0d7070' }}>
              {isEdit ? 'Editar OS' : 'Nova Ordem de Serviço'}
            </span>
            <p className="text-gray-400 text-xs">{profile?.units?.name || 'Selecione a unidade'} · {profile?.full_name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-sm">Sair</button>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-4 pb-10">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* ── Status e Prioridade ── */}
        {isEdit && (
          <div className="card border-2 border-blue-200 bg-blue-50">
            <p className="text-sm font-semibold text-blue-800 mb-3">🔄 Atualizar Status da OS</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {OS_STATUSES.map(s => (
                <label key={s.value} className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 cursor-pointer transition-colors text-sm font-medium
                  ${status === s.value ? s.color + ' border-current' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                  <input type="radio" name="status" className="sr-only" onChange={() => setStatus(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Status (criação) + Prioridade */}
        <div className="card">
          <div className="grid grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <p className="label">Status</p>
                <select className="input" value={status} onChange={e => setStatus(e.target.value as OSStatus)}>
                  {OS_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
            <div className={!isEdit ? '' : 'col-span-2'}>
              <p className="label">Prioridade</p>
              <div className="flex gap-2 mt-1">
                {OS_PRIORITIES.map(p => (
                  <label key={p.value} className={`flex-1 flex items-center justify-center p-2.5 rounded-lg border cursor-pointer transition-colors text-sm font-medium
                    ${priority === p.value
                      ? p.value === 'URGENTE' ? 'border-red-500 bg-red-50 text-red-700'
                        : p.value === 'PLANEJADA' ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}>
                    <input type="radio" name="priority" className="sr-only" onChange={() => setPriority(p.value)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unidade (admin/gestor) */}
        {profile?.role !== 'encarregado' && !isEdit && (
          <div className="card">
            <label className="label">Unidade <span className="text-red-500">*</span></label>
            <select className="input" value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)} required>
              <option value="">Selecione a unidade...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}

        {/* Setor */}
        {sectors.length > 0 && (
          <div className="card">
            <label className="label">Setor</label>
            <select className="input" value={sectorId} onChange={e => setSectorId(e.target.value)}>
              <option value="">Selecione o setor (opcional)...</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Tipo de Atividade */}
        <div className="card">
          <p className="label">Tipo de Atividade <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {ACTIVITY_TYPES.map(t => (
              <label key={t} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                ${activityType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="activity_type" value={t} className="sr-only" onChange={() => setActivityType(t)} required />
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${activityType === t ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`} />
                <span className="text-sm font-medium">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Disciplina / Tipo de Serviço */}
        <div className="card">
          <p className="label">Disciplina (Tipo de Serviço) <span className="text-red-500">*</span></p>
          <div className="space-y-2 mt-1">
            {SERVICE_TYPES.map(t => (
              <label key={t} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                ${serviceType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="service_type" value={t} className="sr-only" onChange={() => setServiceType(t)} required />
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${serviceType === t ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`} />
                <span className="text-sm font-medium">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tipo de Serviço Detalhado */}
        <div className="card">
          <label className="label">Tipo de Tarefa</label>
          <select className="input" value={detailedServiceType} onChange={e => setDetailedServiceType(e.target.value)}>
            <option value="">Selecione...</option>
            {DETAILED_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Data e Horários */}
        <div className={`card space-y-4 ${isEdit ? 'border-2 border-amber-200' : ''}`}>
          {isEdit && <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">⏱ Horários</p>}
          {!isEdit && (
            <div>
              <label className="label">Data da Atividade <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={activityDate}
                onChange={e => setActivityDate(e.target.value)} required={!isEdit} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hora de Início {!isEdit && <span className="text-red-500">*</span>}</label>
              <input type="time" className="input" value={startTime}
                onChange={e => setStartTime(e.target.value)} required={!isEdit} disabled={isEdit} />
            </div>
            <div>
              <label className="label font-semibold text-amber-700">
                Hora de Encerramento {isEdit && <span className="text-amber-600 text-xs">(preencha ao concluir)</span>}
              </label>
              <input type="time" className={`input ${isEdit ? 'border-amber-300 bg-amber-50' : ''}`}
                value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Descrição */}
        <div className="card">
          <label className="label">Descrição da Atividade <span className="text-red-500">*</span></label>
          <textarea className="input min-h-[100px] resize-none" value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descreva a atividade realizada..." required />
        </div>

        {/* Responsável e Colaboradores (apenas criação) */}
        {!isEdit && (
          <>
            <div className="card">
              <label className="label">Profissional Responsável <span className="text-red-500">*</span></label>
              {employees.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum funcionário cadastrado para esta unidade.</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {employees.map(emp => (
                    <label key={emp.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                      ${responsibleId === emp.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="responsible" value={emp.id} className="sr-only"
                        onChange={() => setResponsibleId(emp.id)} required />
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${responsibleId === emp.id ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`} />
                      <span className="text-sm font-medium">{emp.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <p className="label">Colaboradores Envolvidos</p>
              {employees.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum funcionário cadastrado para esta unidade.</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {employees.map(emp => (
                    <label key={emp.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                      ${collaboratorIds.includes(emp.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" className="sr-only"
                        checked={collaboratorIds.includes(emp.id)} onChange={() => toggleCollaborator(emp.id)} />
                      <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center
                        ${collaboratorIds.includes(emp.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`}>
                        {collaboratorIds.includes(emp.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-medium">{emp.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* EPIs */}
        <div className="card">
          <p className="label">EPIs necessários estão sendo utilizados? <span className="text-red-500">*</span></p>
          <div className="flex gap-4 mt-2">
            {[{ label: 'SIM', value: true }, { label: 'NÃO', value: false }].map(opt => (
              <label key={String(opt.value)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                ${epiUsed === opt.value
                  ? opt.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="epi" className="sr-only" onChange={() => setEpiUsed(opt.value)} />
                <span className="font-semibold text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Fotos por Fase */}
        <div className="card">
          <p className="font-semibold text-gray-700 mb-1">📷 Registro Fotográfico</p>
          <p className="text-xs text-gray-400 mb-4">Registre fotos em cada fase do serviço. Toque nas fotos salvas para visualizar em tamanho completo.</p>

          {(['antes', 'durante', 'depois'] as const).map(type => {
            const labels: Record<string, { title: string; icon: string; color: string }> = {
              antes:   { title: 'Início do Serviço',  icon: '🟢', color: 'border-blue-200 bg-blue-50' },
              durante: { title: 'Em Execução',         icon: '🔵', color: 'border-amber-200 bg-amber-50' },
              depois:  { title: 'Finalização',          icon: '✅', color: 'border-green-200 bg-green-50' },
            }
            const { title, icon, color } = labels[type]
            const existing = photosByType(type)
            const newFiles = photos[type]

            return (
              <div key={type} className={`mb-4 last:mb-0 rounded-xl border-2 p-3 ${color}`}>
                {/* Header da fase */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{icon}</span>
                  <span className="font-semibold text-sm text-gray-700">{title}</span>
                  {existing.length > 0 && (
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                      {existing.length} foto{existing.length !== 1 ? 's' : ''} salva{existing.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Grid de fotos existentes */}
                {existing.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {existing.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="block rounded-xl overflow-hidden border-2 border-white shadow-sm hover:shadow-md transition-shadow" style={{ aspectRatio: '1' }}>
                        <img src={p.url} alt={`${title} ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Seletor de novas fotos */}
                <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 bg-white rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-gray-500">
                    {newFiles.length > 0
                      ? `${newFiles.length} nova(s) foto(s) selecionada(s)`
                      : existing.length > 0 ? 'Adicionar mais fotos' : 'Toque para adicionar fotos'}
                  </span>
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={e => handlePhotoChange(type, e.target.files)}
                    capture="environment" />
                </label>

                {/* Preview de novas fotos selecionadas */}
                {newFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {newFiles.map((f, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border-2 border-teal-400 shadow-sm" style={{ aspectRatio: '1' }}>
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button type="submit" className="btn-primary w-full py-4 text-base" disabled={submitting}>
          {submitting
            ? 'Salvando...'
            : isEdit ? '✓ Salvar Alterações' : 'Registrar Ordem de Serviço'
          }
        </button>
      </form>
    </div>
  )
}

export default function FormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>}>
      <FormContent />
    </Suspense>
  )
}

type PhotoType = 'antes' | 'durante' | 'depois'
