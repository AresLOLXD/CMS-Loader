import { useState } from 'preact/hooks'
import { authStatus, csrfToken } from '../signals'

async function refreshCsrfToken() {
  const res = await fetch('/api/csrf-token')
  if (!res.ok) return
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken.value,
        },
        body: JSON.stringify({ username, password }),
      })

      if (res.status === 401) {
        const body = await res.json() as { message?: string }
        throw new Error(body.message ?? 'Credenciales inválidas')
      }

      if (!res.ok) throw new Error(`Error ${res.status}`)

      await refreshCsrfToken()
      authStatus.value = 'authenticated'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '320px', margin: '4rem auto' }}>
      <h1>CMS Loader</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label for="username">Usuario</label>
          <input
            id="username"
            value={username}
            onInput={e => setUsername((e.target as HTMLInputElement).value)}
            required
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onInput={e => setPassword((e.target as HTMLInputElement).value)}
            required
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          />
        </div>
        {error && <p role="alert" style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: '16px', padding: '8px 16px' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
