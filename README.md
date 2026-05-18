# CMS-Loader

Herramienta web de administración para cargar usuarios y participaciones en masa a una instalación de [CMS](https://cms-dev.github.io/) mediante archivos CSV. Invoca los CLI `cmsAddUser` y `cmsAddParticipation` del sistema de forma segura desde el navegador. Diseñada para uso interno por administradores de concursos de programación.

## Prerrequisitos

- Node.js 20+ y [pnpm](https://pnpm.io/)
- CMS instalado con `cmsAddUser` y `cmsAddParticipation` disponibles en el PATH, o accesibles mediante un script de entorno (ver `CMS_ENV_SCRIPT` en [docs/setup.md](docs/setup.md))

## Inicio rápido

```bash
cp .env.example .env   # completar las variables requeridas
pnpm install
pnpm run dev           # servidor en http://localhost:9995
```

Acceder a `http://localhost:9995` — la aplicación pedirá usuario y contraseña de administrador (definidos en `.env`).

## Documentación

- [Instalación en producción](docs/setup.md)
- [Guía de desarrollo](docs/development.md)
