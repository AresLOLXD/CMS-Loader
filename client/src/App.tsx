import { useEffect } from 'preact/hooks'
import { authStatus, csrfToken, wizardStep } from './signals'
import Login from './components/Login'
import UploadStep from './components/steps/UploadStep'
import MappingStep from './components/steps/MappingStep'
import ProcessingStep from './components/steps/ProcessingStep'
import DoneStep from './components/steps/DoneStep'

async function loadCsrfToken() {
  const res = await fetch('/api/csrf-token')
  if (!res.ok) return
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
}

export default function App() {
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(async (body: { authenticated: boolean }) => {
        await loadCsrfToken()
        authStatus.value = body.authenticated ? 'authenticated' : 'unauthenticated'
      })
      .catch(() => {
        authStatus.value = 'unauthenticated'
      })
  }, [])

  return (
    <div>
      {authStatus.value === 'checking' && <p>Cargando...</p>}
      {authStatus.value === 'unauthenticated' && <Login />}
      {authStatus.value === 'authenticated' && (
        <>
          {wizardStep.value === 'upload' && <UploadStep />}
          {wizardStep.value === 'mapping' && <MappingStep />}
          {wizardStep.value === 'processing' && <ProcessingStep />}
          {wizardStep.value === 'done' && <DoneStep />}
        </>
      )}
      {authStatus.value !== 'checking' && (
        <footer style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#888' }}>
          v{import.meta.env.VITE_APP_VERSION}
        </footer>
      )}
    </div>
  )
}
