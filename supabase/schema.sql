-- ============================================================
-- SCHEMA - APP ORDENS DE SERVIÇO (GUANDU)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. UNIDADES
CREATE TABLE units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PERFIS (vinculados ao auth.users do Supabase)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'gestor', 'encarregado')),
  unit_id UUID REFERENCES units(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUNCIONÁRIOS (responsáveis/colaboradores nas OS)
-- Gerenciados pelo super_admin — não são usuários do sistema
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDENS DE SERVIÇO
CREATE TABLE service_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID REFERENCES units(id) NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'PREVENTIVA', 'CORRETIVA', 'MELHORIAS', 'OUTROS'
  )),
  service_type TEXT NOT NULL CHECK (service_type IN (
    'ELÉTRICA', 'MECÂNICA', 'CIVIL', 'PINTURA',
    'CALDERARIA E SOLDAGEM', 'AUTOMAÇÃO/INSTRUMENTAÇÃO', 'APOIO OPERACIONAL'
  )),
  activity_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  description TEXT NOT NULL,
  responsible_id UUID REFERENCES employees(id),
  epi_used BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. COLABORADORES POR OS (relação N:N)
CREATE TABLE service_order_collaborators (
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (service_order_id, employee_id)
);

-- 6. FOTOS
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('antes', 'durante', 'depois')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para pegar o role do usuário logado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Função auxiliar para pegar a unidade do usuário logado
CREATE OR REPLACE FUNCTION get_user_unit()
RETURNS UUID AS $$
  SELECT unit_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- UNITS: todos autenticados podem ver; só super_admin altera
CREATE POLICY "units_select" ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_insert" ON units FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'super_admin');
CREATE POLICY "units_update" ON units FOR UPDATE TO authenticated USING (get_user_role() = 'super_admin');

-- PROFILES: cada um vê o próprio; super_admin vê todos
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_user_role() = 'super_admin');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'super_admin' OR id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_user_role() = 'super_admin');

-- EMPLOYEES: todos veem; super_admin e gestor alteram
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'gestor'));
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'gestor'));
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated
  USING (get_user_role() = 'super_admin');

-- SERVICE_ORDERS: encarregado cria da sua unidade; gestor/admin veem tudo
CREATE POLICY "so_select" ON service_orders FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'gestor')
    OR (get_user_role() = 'encarregado' AND unit_id = get_user_unit())
  );
CREATE POLICY "so_insert" ON service_orders FOR INSERT TO authenticated
  WITH CHECK (unit_id = get_user_unit() OR get_user_role() = 'super_admin');
CREATE POLICY "so_update" ON service_orders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR get_user_role() IN ('super_admin', 'gestor'));

-- COLLABORATORS
CREATE POLICY "collab_select" ON service_order_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "collab_insert" ON service_order_collaborators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collab_delete" ON service_order_collaborators FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'gestor'));

-- PHOTOS
CREATE POLICY "photos_select" ON photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "photos_insert" ON photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "photos_delete" ON photos FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'gestor'));

-- ============================================================
-- STORAGE BUCKET PARA FOTOS
-- ============================================================
-- Execute no dashboard Supabase > Storage > New Bucket:
-- Nome: "os-photos"  |  Público: SIM

-- ============================================================
-- DADOS INICIAIS — unidade Guandu
-- ============================================================
INSERT INTO units (name) VALUES ('GUANDU');

-- Após criar o primeiro usuário no Supabase Auth, execute:
-- INSERT INTO profiles (id, full_name, role, unit_id)
-- VALUES ('<UUID_DO_AUTH_USER>', 'Nome do Admin', 'super_admin', NULL);
