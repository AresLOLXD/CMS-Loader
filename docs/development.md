# Guía de desarrollo

## Comandos

| Comando | Descripción |
|---|---|
| `pnpm run dev` | Servidor con ts-node en modo desarrollo (sin compilar) |
| `pnpm run build` | Limpia `dist/`, compila TypeScript y copia assets EJS/estáticos |
| `pnpm start` | Build completo + ejecuta `dist/index.js` |
| `pnpm test` | Corre la suite de tests con vitest |
| `npx eslint src/` | Lint del código fuente TypeScript |
| `npx tsc --noEmit` | Type-check sin generar archivos |

No hay hot-reload en modo dev; reiniciar el servidor manualmente tras cambios.

## Flujo de las operaciones principales

**Registrar usuarios:**  
El usuario sube un CSV → `POST /analyzeCSV` parsea el archivo, almacena los registros en un `Job` (en memoria) y devuelve la lista de columnas detectadas → el navegador muestra el formulario de mapeo de columnas → al enviar, `POST /registerUsers` inicia el job de forma asíncrona y devuelve el `jobId` → el cliente se conecta a `GET /jobs/:id/events` (Server-Sent Events) para recibir progreso en tiempo real → al terminar, el usuario descarga un CSV con contraseñas generadas o errores en `GET /jobs/:id/result`.

**Agregar participaciones:**  
El flujo es idéntico, pero el formulario de mapeo expone campos de concurso y `POST /addParticipation` invoca `cmsAddParticipation`. El CSV de resultado contiene solo las filas con errores (sin contraseñas).

## Arquitectura clave

- **Sin base de datos.** La sesión (`express-session`) es el único estado persistente entre requests. Si la sesión expira o se destruye, el job queda inaccesible para el usuario pero el TTL del JobStore lo limpia después de 1 hora.
- **JobStore en memoria.** `src/jobs/JobStore.ts` mantiene un `Map<string, Job>`. Los jobs tienen TTL de 1 hora y el cleanup corre cada 10 minutos. Al reiniciar el proceso se pierden todos los jobs en curso.
- **Controladores como Routers.** Cada controlador en `src/controllers/` crea un `Router`, registra sus rutas y exporta el router. Se montan en `src/router.ts`. Para agregar un endpoint nuevo, seguir este patrón.
- **`req.session.saveAsync`.** La sesión expone `save()` basado en callbacks. El middleware en `src/index.ts` adjunta `saveAsync` (versión promisificada) para que los controladores async puedan hacer `await req.session.saveAsync()` antes de responder.

## Trampas conocidas

- **No eludir `shellescape`.** Se usa intencionalmente en `src/utils/buildCmsCommand.ts` para prevenir shell injection al construir los comandos CLI. No reemplazar por concatenación directa.
- **El `replace(/'""'/g, '""')` es intencional.** `shellescape` convierte strings vacíos a `''`. El replace los transforma a `""`, que es lo que el CLI de CMS espera como argumentos vacíos.
- **Cleanup de multer en `finally`.** El archivo temporal subido por el usuario se elimina en el bloque `finally` de `src/controllers/analyzeCSV.ts`. Cualquier refactor debe preservar esta limpieza para no llenar el directorio `uploads/`.
- **Tests parciales.** La suite de vitest incluye tests unitarios y un test de integración para `analyzeCSV`. No hay cobertura end-to-end del flujo completo; verificar cambios en los flujos de registro/participación corriendo `pnpm run dev` y ejerciendo la ruta afectada manualmente en el navegador.
