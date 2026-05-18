import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, mapping, jobId, wizardStep } from '../../signals'
import { fieldsConfig } from '../../config'

async function retryCsrf(): Promise<string> {
  const res = await fetch('/api/csrf-token')
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
  return body.token
}

export default function MappingStep() {
  const fields = fieldsConfig[mode.value]
  const [localMapping, setLocalMapping] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, '']))
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    const missing = fields.filter(f => f.required && !localMapping[f.name])
    if (missing.length) {
      setError(`Campo requerido sin asignar: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    setLoading(true)
    setError('')
    const endpoint = mode.value === 'users' ? '/registerUsers' : '/addParticipation'
    let token = csrfToken.value

    try {
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(localMapping),
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          body: JSON.stringify(localMapping),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message ?? `Error ${res.status}`)
      }

      const body = await res.json() as { jobId: string }
      mapping.value = localMapping
      jobId.value = body.jobId
      wizardStep.value = 'processing'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>2 — Mapeo de columnas</h2>
      <p>Los marcados con * son requeridos.</p>
      {fields.map(field => (
        <div key={field.name} style={{ marginTop: '10px' }}>
          <label for={`field-${field.name}`}>{field.label}{field.required ? ' *' : ''}</label>
          <select
            id={`field-${field.name}`}
            value={localMapping[field.name]}
            onChange={e => {
              const val = (e.target as HTMLSelectElement).value
              setLocalMapping(prev => ({ ...prev, [field.name]: val }))
            }}
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          >
            <option value="">(No asignado)</option>
            {columns.value.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
      ))}
      {error && <p role="alert" style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => { wizardStep.value = 'upload' }} disabled={loading}>Volver</button>
        <button onClick={handleSend} disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
