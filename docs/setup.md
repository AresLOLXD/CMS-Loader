# Instalación en producción

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

| Variable | Requerida | Descripción |
|---|---|---|
| `SESSION_SECRET` | Sí | Cadena aleatoria de 32+ caracteres para firmar cookies de sesión y tokens CSRF |
| `ADMIN_USER` | Sí | Nombre de usuario del administrador |
| `ADMIN_PASSWORD` | Sí | Contraseña del administrador |
| `PORT` | No (default: `9995`) | Puerto en que escucha el servidor |
| `NODE_ENV` | No | Establecer en `production` en despliegue real |
| `CMS_ENV_SCRIPT` | No | Ruta absoluta a un script shell que exporta el entorno del CLI de CMS |
| `CMS_CONCURRENCY` | No (default: `5`) | Número de llamadas concurrentes al CLI de CMS por trabajo |

## Correr en producción

```bash
# 1. Instalar dependencias (incluyendo devDependencies para la compilación)
pnpm install

# 2. Compilar TypeScript y copiar assets
pnpm run build

# 3. Ejecutar en producción
NODE_ENV=production node dist/index.js
```

> No usar `pnpm install --prod` antes del build: las devDependencies (TypeScript, rimraf, copyfiles) son necesarias para compilar.

## Detrás de un reverse proxy

Cuando la aplicación corre detrás de nginx u otro proxy, `NODE_ENV=production` habilita automáticamente `trust proxy: 1`, cookies `secure: true` y `sameSite: none`. Sin esto, las cookies de sesión no funcionarán sobre HTTPS.

Ejemplo mínimo de configuración nginx:

```nginx
server {
    listen 443 ssl;
    server_name cms-loader.example.com;

    # certificados TLS aquí ...

    location / {
        proxy_pass http://127.0.0.1:9995;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Necesario para el streaming SSE de progreso
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

> La directiva `proxy_buffering off` es necesaria para que los eventos SSE (barra de progreso) lleguen al cliente en tiempo real.

> Ajustar `proxy_read_timeout` según el volumen de datos esperado. Para lotes grandes, considerar un valor más alto (por ejemplo, `600s` o `1800s`).

## CLI de CMS: modo contenedor vs. bare-metal

**Modo contenedor (por defecto):** dejar `CMS_ENV_SCRIPT` sin definir. Los comandos `cmsAddUser` y `cmsAddParticipation` deben estar en el `PATH` del proceso Node.js.

**Modo bare-metal:** si CMS está instalado en un virtualenv Python o requiere variables de entorno especiales, definir `CMS_ENV_SCRIPT` con la ruta absoluta al script de entorno de CMS. Por ejemplo:

```env
CMS_ENV_SCRIPT=/var/local/lib/cms/cmsEnv.sh
```

El servidor ejecutará `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ...` antes de cada llamada al CLI.
