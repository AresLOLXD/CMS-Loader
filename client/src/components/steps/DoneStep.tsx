import { columns, jobId, mapping, mode, wizardStep } from '../../signals'

function resetWizard() {
  wizardStep.value = 'upload'
  columns.value = []
  mapping.value = {}
  jobId.value = null
  mode.value = 'users'
}

export default function DoneStep() {
  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>Operación completada</h2>
      <p>El archivo de resultados fue descargado automáticamente.</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={resetWizard} style={{ padding: '8px 16px' }}>Nueva carga</button>
        <button onClick={() => { window.location.href = '/logout' }} style={{ padding: '8px 16px' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
