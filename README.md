# Consultorio San Juan — Sistema interno

Aplicación web real (no una demo) para el consultorio: farmacia (catálogo,
ventas, tickets en PDF) y expediente médico (notas de evolución, canalización
entre áreas, tareas de enfermería, agenda por persona, planes de tratamiento
en PDF).

Stack: **Next.js 14 + TypeScript + Tailwind**, base de datos y autenticación
en **Supabase**, hosting en **Vercel**, código en **GitHub**.

---

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **New project**.
2. Elige un nombre (ej. `consultorio-san-juan`), una contraseña de base de
   datos (guárdala, no la necesitarás casi nunca) y la región más cercana
   (`us-east-1` o similar).
3. Cuando el proyecto esté listo, ve a **SQL Editor → New query**, pega todo
   el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y ejecútalo
   (▶ Run). Esto crea todas las tablas, la seguridad por fila (RLS) y activa
   Realtime.
4. Ve a **Project Settings → API**. Copia:
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. (Opcional pero recomendado para empezar rápido) En **Authentication →
   Providers → Email**, desactiva "Confirm email" mientras hacen pruebas
   internas, así cada nueva cuenta entra de inmediato sin esperar un correo
   de confirmación. Puedes reactivarlo después si quieres ese paso extra de
   seguridad.

## 2. Configurar el proyecto localmente

```bash
npm install
cp .env.example .env.local
```

Edita `.env.local` y pega tus dos valores de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Corre en local:

```bash
npm run dev
```

Abre http://localhost:3000 → te llevará a `/login`. Da clic en "Crea tu
cuenta", registra tu correo y contraseña, completa tu perfil (nombre, rol) y
listo — ya estás dentro.

### Convertirte en administrador

Por default el primer usuario no tiene privilegios especiales de
administrador (solo puede editar su propio perfil). Para poder borrar
perfiles de otras personas, en el **SQL Editor** de Supabase corre:

```sql
update public.profiles set rol = 'admin'
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```

## 3. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Consultorio San Juan: primera versión"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/consultorio-san-juan.git
git push -u origin main
```

(Crea antes el repositorio vacío en https://github.com/new — sin README ni
.gitignore, para no chocar con lo que ya trae este proyecto.)

## 4. Desplegar en Vercel

1. Ve a https://vercel.com → **Add New → Project** → importa el repositorio
   de GitHub que acabas de crear.
2. En **Environment Variables**, agrega las mismas dos variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. En un par de minutos tendrás una URL pública
   (`https://consultorio-san-juan.vercel.app` o la que elijas) con dominio
   propio opcional desde la configuración del proyecto en Vercel.

Cada vez que hagan `git push` a `main`, Vercel vuelve a desplegar
automáticamente.

## 5. Dar de alta al resto del equipo

No hay un formulario especial de "alta de personal": cada doctor, enfermera
o encargado de farmacia entra a la URL pública, da clic en **"Crea tu
cuenta"**, pone su correo y contraseña, y completa su nombre y rol. Aparece
automáticamente en la pestaña **Equipo** y ya puede usar su propia agenda y
ver los expedientes relacionados con él/ella.

## Estructura del proyecto

```
app/
  login/           → inicio de sesión
  signup/          → registro de cuenta
  onboarding/      → completar perfil (nombre, rol, especialidad)
  (app)/           → rutas protegidas (requieren sesión + perfil)
    dashboard/     → inicio: agenda de hoy, canalizaciones, tareas de enfermería
    agenda/        → citas
    pacientes/     → lista y alta de pacientes
    pacientes/[id] → expediente médico completo
    farmacia/      → catálogo, ventas, tickets
    equipo/        → personal del consultorio
components/
  NavBar.tsx
lib/
  supabase/        → clientes de Supabase (browser y server)
  types.ts         → tipos compartidos
  pdf.ts           → generación de PDFs (plan de tratamiento, resumen, ticket)
middleware.ts      → protege rutas y mantiene la sesión activa
supabase/schema.sql→ esquema completo de base de datos + seguridad por fila
```

## Nota sobre cumplimiento normativo (NOM-004)

Este sistema cubre los campos base del expediente clínico: datos generales,
antecedentes heredofamiliares y personales, nota de evolución con
diagnóstico y tratamiento, identificación del personal que atendió, y
canalización entre áreas. La NOM-004 completa exige también, entre otras
cosas, consentimiento informado para ciertos procedimientos y controles más
estrictos de confidencialidad. Antes de operar con expedientes reales de
pacientes, es recomendable que alguien con conocimiento normativo en salud
revise el sistema.

## Próximos pasos sugeridos

- Roles más granulares (por ejemplo, que un doctor no pueda editar el
  catálogo de farmacia).
- Historial de auditoría (quién editó qué y cuándo).
- Recuperación de contraseña (ya viene incluida en Supabase Auth, solo falta
  agregar la pantalla correspondiente).
- Respaldos automáticos (Supabase los hace diariamente en planes de pago).
