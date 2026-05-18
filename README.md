# CMS-Loader

Herramienta web de administración para cargar usuarios y participaciones en masa a una instalación de [CMS](https://cms-dev.github.io/) mediante archivos CSV. Invoca los CLI `cmsAddUser` y `cmsAddParticipation` del sistema de forma segura desde el navegador. Diseñada para uso interno por administradores de concursos de programación.

**Backend:** Express 5, TypeScript, tsx, express-session, csrf-csrf, multer  
**Frontend:** Preact 10, @preact/signals, Vite 6, TypeScript

## Prerrequisitos

- Node.js 22+ y [pnpm](https://pnpm.io/)
- CMS instalado con `cmsAddUser` y `cmsAddParticipation` disponibles en el PATH, o accesibles mediante un script de entorno (ver `CMS_ENV_SCRIPT` en [docs/setup.md](docs/setup.md))

## Inicio rápido

```bash
cp .env.example .env   # completar las variables requeridas
pnpm install
```

Ejecutar en dos terminales:

```bash
# Terminal 1
pnpm run dev:backend   # Express en http://localhost:9995
```

```bash
# Terminal 2
pnpm run dev:frontend  # Vite en http://localhost:5173
```

Acceder a `http://localhost:5173` — la aplicación pedirá usuario y contraseña de administrador (definidos en `.env`).

## Build

```bash
pnpm run build   # compila el SPA Preact a client/dist/
```

## Producción

```bash
pnpm start   # build + tsx src/index.ts en el puerto PORT (default 9995)
```

## Versionamiento

El proyecto utiliza Conventional Commits con [semantic-release](https://semantic-release.gitbook.io/). Al hacer `git push origin main`, Husky ejecuta semantic-release automáticamente: actualiza `package.json`, genera `CHANGELOG.md` y crea un tag git.

| Prefijo | Efecto |
|---|---|
| `feat:` | Incremento menor (0.x.0) |
| `fix:` | Incremento de parche (0.0.x) |
| `feat!:` / `BREAKING CHANGE:` | Incremento mayor (x.0.0) |
| `chore:`, `docs:`, `test:` | Sin release |

La versión actual se muestra en el pie de página de la aplicación.

## Documentación

- [Instalación en producción](docs/setup.md)
- [Guía de desarrollo](docs/development.md)
