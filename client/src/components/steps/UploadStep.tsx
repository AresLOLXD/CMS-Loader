import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, wizardStep } from '../../signals'
import type { Mode } from '../../signals'

async function retryCsrf(): Promise<string> {
  const res = await fetch('/api/csrf-token')
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
  return body.token
}

export default function UploadStep() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) { setError('Selecciona un archivo CSV'); return }
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('El archivo debe tener extensión .csv'); return }

    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('archivo', file)
    let token = csrfToken.value

    try {
      let res = await fetch('/analyzeCSV', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
        body: formData,
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch('/analyzeCSV', {
          method: 'POST',
          headers: { 'x-csrf-token': token },
          body: formData,
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message ?? `Error ${res.status}`)
      }

      const body = await res.json() as { success: boolean; data: { columnas: string[] } }
      if (!body.success || !body.data.columnas.length) throw new Error('No se encontraron columnas en el CSV')

      columns.value = body.data.columnas
      wizardStep.value = 'mapping'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h1>CMS Loader</h1>
      <h2>1 — Subir CSV</h2>
      <div>
        <label for="mode-select">Tipo de operación</label>
        <select
          id="mode-select"
          value={mode.value}
          onChange={e => { mode.value = (e.target as HTMLSelectElement).value as Mode }}
          disabled={loading}
          style={{ display: 'block', marginTop: '4px' }}
        >
          <option value="users">Usuarios</option>
          <option value="contest">Concurso</option>
        </select>
      </div>
      <div style={{ marginTop: '12px' }}>
        <label for="csv-file">Archivo CSV</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={e => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
          disabled={loading}
          style={{ display: 'block', marginTop: '4px' }}
        />
      </div>
      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        style={{ marginTop: '16px', padding: '8px 16px' }}
      >
        {loading ? 'Analizando...' : 'Subir CSV'}
      </button>
    </div>
  )
}
