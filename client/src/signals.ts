import { signal } from '@preact/signals'

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'
export type WizardStep = 'upload' | 'mapping' | 'processing' | 'done'
export type Mode = 'users' | 'contest'

export const authStatus = signal<AuthStatus>('checking')
export const csrfToken = signal<string>('')
export const wizardStep = signal<WizardStep>('upload')
export const mode = signal<Mode>('users')
export const columns = signal<string[]>([])
export const mapping = signal<Record<string, string>>({})
export const jobId = signal<string | null>(null)
