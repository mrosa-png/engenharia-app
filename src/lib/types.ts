export type UserRole = 'super_admin' | 'gestor' | 'encarregado'

export type ActivityType = 'PREVENTIVA' | 'CORRETIVA' | 'MELHORIAS' | 'OUTROS'

export type ServiceType =
  | 'ELÉTRICA'
  | 'MECÂNICA'
  | 'CIVIL'
  | 'PINTURA'
  | 'CALDERARIA E SOLDAGEM'
  | 'AUTOMAÇÃO/INSTRUMENTAÇÃO'
  | 'APOIO OPERACIONAL'

export type DetailedServiceType =
  | 'Inspeção/Teste'
  | 'Manutenção preventiva'
  | 'Montagem/desmontagem'
  | 'Limpeza/organização'
  | 'Transporte/movimentação'
  | 'Substituição'
  | 'Pintura'
  | 'Alvenaria'
  | 'Outros'

export type OSStatus = 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUÍDA'
export type OSPriority = 'ROTINA' | 'URGENTE' | 'PLANEJADA'

export type PhotoType = 'antes' | 'durante' | 'depois'

export interface Unit {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface Sector {
  id: string
  unit_id: string
  name: string
  active: boolean
  created_at: string
  units?: Unit
}

export type EquipmentCategory =
  | 'Bomba'
  | 'Compressor'
  | 'Motor'
  | 'Válvula'
  | 'Painel Elétrico'
  | 'Transportador'
  | 'Caldeira/Vaso'
  | 'Instrumento'
  | 'Estrutura/Civil'
  | 'Outro'

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'Bomba', 'Compressor', 'Motor', 'Válvula', 'Painel Elétrico',
  'Transportador', 'Caldeira/Vaso', 'Instrumento', 'Estrutura/Civil', 'Outro',
]

export interface Equipment {
  id: string
  unit_id: string
  sector_id?: string | null
  name: string
  tag?: string | null
  category?: EquipmentCategory | null
  active: boolean
  created_at: string
  units?: Unit
  sectors?: Sector
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  unit_id: string | null
  active: boolean
  created_at: string
  units?: Unit
}

export interface Employee {
  id: string
  name: string
  unit_id: string
  active: boolean
  created_at: string
  units?: Unit
}

export interface Photo {
  id: string
  service_order_id: string
  photo_type: PhotoType
  storage_path: string
  url: string
  created_at: string
}

export interface ServiceOrderCollaborator {
  service_order_id: string
  employee_id: string
  employees?: Employee
}

export interface ServiceOrder {
  id: string
  unit_id: string
  sector_id?: string | null
  sectors?: Sector
  equipment_id?: string | null
  equipments?: Equipment
  activity_type: ActivityType
  service_type: ServiceType
  detailed_service_type?: DetailedServiceType | null
  status?: OSStatus
  priority?: OSPriority
  activity_date: string
  start_time: string
  end_time: string | null
  description: string
  responsible_id: string | null
  epi_used: boolean
  created_by: string | null
  created_at: string
  units?: Unit
  employees?: Employee
  photos?: Photo[]
  service_order_collaborators?: ServiceOrderCollaborator[]
}

export const ACTIVITY_TYPES: ActivityType[] = [
  'PREVENTIVA',
  'CORRETIVA',
  'MELHORIAS',
  'OUTROS',
]

export const SERVICE_TYPES: ServiceType[] = [
  'ELÉTRICA',
  'MECÂNICA',
  'CIVIL',
  'PINTURA',
  'CALDERARIA E SOLDAGEM',
  'AUTOMAÇÃO/INSTRUMENTAÇÃO',
  'APOIO OPERACIONAL',
]

export const DETAILED_SERVICE_TYPES: DetailedServiceType[] = [
  'Inspeção/Teste',
  'Manutenção preventiva',
  'Montagem/desmontagem',
  'Limpeza/organização',
  'Transporte/movimentação',
  'Substituição',
  'Pintura',
  'Alvenaria',
  'Outros',
]

export const OS_STATUSES: { value: OSStatus; label: string; color: string }[] = [
  { value: 'ABERTA', label: 'Aberta', color: 'bg-blue-100 text-blue-700' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  { value: 'CONCLUÍDA', label: 'Concluída', color: 'bg-green-100 text-green-700' },
]

export const OS_PRIORITIES: { value: OSPriority; label: string }[] = [
  { value: 'ROTINA', label: 'Rotina' },
  { value: 'URGENTE', label: 'Urgente' },
  { value: 'PLANEJADA', label: 'Planejada' },
]
