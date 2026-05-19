import { useEffect, useState } from 'preact/hooks'
import { jobId, mode, wizardStep } from '../../signals'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 100 ms gives Firefox time to initiate the async download before the blob URL is freed
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export default function ProcessingStep() {
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId.value) {
      wizardStep.value = 'mapping'
    }
  }, [])

  useEffect(() => {
    const currentJobId = jobId.value
    if (!currentJobId) return

    let closed = false
    const source = new EventSource(`/jobs/${currentJobId}/events`)

    source.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { processed: number; total: number; percent: number }
      setProcessed(data.processed)
      setTotal(data.total)
      setPercent(data.percent)
    })

    source.addEventListener('done', async () => {
      closed = true
      source.close()
      const filename = mode.value === 'users' ? 'Resultados usuarios.csv' : 'Errores concurso.csv'
      try {
        const res = await fetch(`/jobs/${currentJobId}/result`)
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size > 0) downloadBlob(blob, filename)
        }
      } catch {
        // download failure is non-fatal
      }
      wizardStep.value = 'done'
    })

    source.addEventListener('job-error', (e: MessageEvent) => {
      closed = true
      source.close()
      const data = JSON.parse(e.data) as { message?: string }
      setError(data.message ?? 'Error interno en el procesamiento')
    })

    source.onerror = () => {
      if (closed) return
      source.close()
      setError('Error de conexión con el servidor.')
    }

    return () => source.close()
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
        <h2>Error en el procesamiento</h2>
        <p role="alert" style={{ color: 'red' }}>{error}</p>
        <button onClick={() => { wizardStep.value = 'mapping' }}>Volver al mapeo</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>3 — Procesando</h2>
      <p>{total > 0 ? `Procesando ${processed} de ${total} registros` : 'Iniciando...'}</p>
      <progress value={percent} max={100} style={{ width: '100%', marginTop: '8px' }} />
    </div>
  )
}
