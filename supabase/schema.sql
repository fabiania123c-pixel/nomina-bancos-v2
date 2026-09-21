-- Esquema del Sistema de Nómina Bancos
-- Correr esto completo en Supabase → SQL Editor → New query → Run.
--
-- No crea usuarios (eso se hace en Authentication → Users, a mano, para los
-- ~6 usuarios reales). Esto solo crea las tablas y los permisos.

-- ============================================================
-- 1. PERFILES (rol de cada usuario)
-- ============================================================
-- Supabase Auth ya maneja login/contraseña en su propia tabla interna
-- (auth.users). Esta tabla "profiles" es la que le agrega el rol
-- (operador / admin) a cada usuario, y vive conectada 1 a 1 con auth.users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('operador', 'admin')),
  creado_en timestamptz not null default now()
);

-- Cuando se crea un usuario nuevo en Authentication, hay que agregarle
-- también su fila en profiles a mano (ver instrucciones al final de este
-- archivo) — no se crea sola.

-- ============================================================
-- 2. HISTORIAL DE CORRIDAS
-- ============================================================
-- Una fila por cada vez que alguien genera archivos y da "Finalizar proceso".
-- guardamos el detalle por banco en una columna JSON (registros y monto por
-- banco), no una fila por banco — más simple de leer para el resumen.

create table if not exists public.corridas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('nomina_regular', 'finiquito')),
  generado_por uuid not null references public.profiles(id),
  fecha timestamptz not null default now(),
  -- ejemplo de detalle_bancos:
  -- {"produbanco": {"registros": 500, "total": 125000.50},
  --  "pichincha":  {"registros": 200, "total": 48000.00},
  --  "guayaquil":  {"registros": 47,  "total": 12000.00}}
  detalle_bancos jsonb not null,
  registros_con_error int not null default 0,
  finalizado boolean not null default false,
  finalizado_en timestamptz
);

-- ============================================================
-- 3. ROW LEVEL SECURITY — nadie ve ni escribe nada sin pasar por estas reglas
-- ============================================================

alter table public.profiles enable row level security;
alter table public.corridas enable row level security;

-- profiles: cualquier usuario logueado puede ver su propio perfil y el de
-- los demás (hace falta para saber roles), pero nadie puede editarlo desde
-- la app (los roles se cambian a mano desde el panel de Supabase, no desde
-- la interfaz, para evitar que alguien se autoasigne admin).
create policy "cualquiera logueado puede ver perfiles"
  on public.profiles for select
  to authenticated
  using (true);

-- corridas: cualquier usuario logueado puede ver el historial completo
-- (tanto operadores como admin necesitan verlo).
create policy "cualquiera logueado puede ver corridas"
  on public.corridas for select
  to authenticated
  using (true);

-- corridas: cualquier usuario logueado puede crear una corrida nueva
-- (cuando genera y descarga archivos).
create policy "cualquiera logueado puede crear corridas"
  on public.corridas for insert
  to authenticated
  with check (generado_por = auth.uid());

-- corridas: solo quien la creó puede actualizarla (para marcar "finalizado"
-- al darle al botón correspondiente).
create policy "solo el creador puede finalizar su corrida"
  on public.corridas for update
  to authenticated
  using (generado_por = auth.uid());

-- ============================================================
-- Instrucciones para crear los ~6 usuarios reales
-- ============================================================
-- 1. Panel de Supabase → Authentication → Users → "Add user" → correo +
--    contraseña temporal (que cada quien cambie en su primer login).
-- 2. Copiar el "User UID" que te muestra ahí.
-- 3. Correr esto por cada usuario, reemplazando los valores:
--
--    insert into public.profiles (id, nombre, rol)
--    values ('PEGA-EL-UID-AQUI', 'Nombre Apellido', 'operador');
--
--    (usa 'admin' en vez de 'operador' para el Jefe)
