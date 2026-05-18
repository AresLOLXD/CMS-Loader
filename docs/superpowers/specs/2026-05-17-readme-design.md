# README Design Spec — CMS-Loader

**Date:** 2026-05-17  
**Approach:** README portada + docs separados (opción C)  
**Idioma:** Español  
**Audiencia:** Devs + sysadmins  

---

## Objetivo

Producir documentación de usuario externa para CMS-Loader: una herramienta interna privada de administración que permite cargar usuarios y participaciones en masa a una instalación de CMS via CSV.

No existe README actualmente. El CLAUDE.md existe pero está orientado a Claude Code, no al usuario final.

---

## Estructura de archivos

```
README.md              ← portada pública
docs/setup.md          ← guía de instalación para sysadmins
docs/development.md    ← guía de desarrollo para devs
```

---

## README.md — Portada (~40 líneas)

**Contenido:**
1. Título (`# CMS-Loader`) + descripción de 2-3 oraciones: qué hace, qué CLI usa, para quién es
2. **Prerrequisitos** (lista):
   - Node.js 20+, pnpm
   - CMS instalado con `cmsAddUser` y `cmsAddParticipation` en el PATH (o accesible vía `CMS_ENV_SCRIPT`)
3. **Inicio rápido** — 3 pasos en bloque de código:
   ```
   cp .env.example .env   # rellenar variables
   pnpm install
   pnpm run dev
   ```
4. **Documentación** — dos enlaces:
   - [Instalación en producción](docs/setup.md)
   - [Guía de desarrollo](docs/development.md)

**Restricciones:**
- No listar todas las variables de entorno aquí (eso va en setup.md)
- No explicar el flujo completo (eso va en development.md)
- Debe poder leerse en menos de 30 segundos

---

## docs/setup.md — Instalación en producción (~60 líneas)

**Contenido:**
1. **Variables de entorno** — tabla con tres columnas: Variable | Requerida | Descripción

   | Variable | Requerida | Descripción |
   |---|---|---|
   | `SESSION_SECRET` | Sí | Secreto para firmar cookies de sesión |
   | `ADMIN_USER` | Sí | Nombre de usuario del administrador |
   | `ADMIN_PASSWORD` | Sí | Contraseña del administrador |
   | `PORT` | No (default: 9995) | Puerto en que escucha el servidor |
   | `NODE_ENV` | No | Usar `production` en despliegue real |
   | `CMS_ENV_SCRIPT` | No | Ruta a script que exporta el entorno de CMS CLI |
   | `CMS_CONCURRENCY` | No (default: 5) | Llamadas concurrentes al CLI de CMS |

2. **Correr en producción** — bloque de código con `NODE_ENV=production pnpm start`
3. **Detrás de un reverse proxy** — nota sobre `trust proxy: 1`, cookies `secure: true` y `sameSite: none`; ejemplo mínimo de config nginx
4. **Requisito del CLI de CMS** — explicación de cuándo usar `CMS_ENV_SCRIPT` (cuando CMS está en un virtualenv o necesita variables especiales)

---

## docs/development.md — Guía de desarrollo (~50 líneas)

**Contenido:**
1. **Comandos** — tabla o lista:

   | Comando | Descripción |
   |---|---|
   | `pnpm run dev` | Servidor con ts-node (recarga manual) |
   | `pnpm run build` | Compila TypeScript + copia assets a `dist/` |
   | `pnpm start` | Build + ejecuta `dist/index.js` |
   | `pnpm test` | Corre tests con vitest |
   | `npx eslint src/` | Lint |
   | `npx tsc --noEmit` | Type-check sin emitir |

2. **Flujo de las operaciones principales** — dos párrafos:
   - **Registrar usuarios:** Upload CSV → `POST /analyzeCSV` → columnas devueltas como JSON → usuario mapea columnas → `POST /registerUsers` → job async → SSE progress en `/jobs/:id/events` → descarga CSV de contraseñas/errores en `/jobs/:id/result`
   - **Agregar participaciones:** mismo flujo pero termina en `POST /addParticipation` y el CSV de resultado contiene solo errores

3. **Arquitectura clave** (lista de 4 puntos):
   - Sesión (`express-session`) es el único estado — no hay base de datos
   - `JobStore` es un Map en memoria con TTL de 1 hora y limpieza cada 10 min
   - Cada controlador es un `Router` independiente montado en `src/router.ts`
   - `req.session.saveAsync` es la versión promisificada de `session.save`, adjuntada en middleware

4. **Trampas conocidas** (lista):
   - `shellescape` se usa intencionalmente para prevenir shell injection — no eludirlo
   - El `replace(/'""'/g, '""')` después de shellescape desescapa strings vacíos que el CLI de CMS espera como `""`
   - Los archivos temporales de multer se eliminan en el bloque `finally` de `analyzeCSV` — preservar ese cleanup en cualquier refactor
   - No existe suite de tests de integración completa; verificar cambios corriendo el servidor y probando la ruta afectada manualmente

---

## Decisiones de diseño

- **Español:** coherente con el contexto de uso (herramienta interna, comentarios del código en español)
- **Sin diagrama ASCII:** la descripción en prosa del flujo en `development.md` es suficiente para el alcance pragmático acordado
- **Sin referencia de API endpoints:** esta no es una API pública; el router está en `src/router.ts` y es fácil de leer directamente
- **CLAUDE.md no se toca:** ese archivo es instrucción para Claude Code, no para usuarios; el README es documentación separada
