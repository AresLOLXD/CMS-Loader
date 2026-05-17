import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../utils/executeProcess', () => ({
    executeProcess: vi.fn(),
}))

import { procesaRegistro } from '../../controllers/registerUsers'
import { executeProcess } from '../../utils/executeProcess'

const mockExecute = vi.mocked(executeProcess)

beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue('')
})

describe('procesaRegistro (registerUsers)', () => {
    it('passes all optional fields as CLI args when present in record', async () => {
        const registro = {
            email_col: 'user@example.com',
            tz_col: 'America/Mexico_City',
            lang_col: 'es',
            pass_col: 'secret',
            name_col: 'Juan',
            last_col: 'Perez',
            user_col: 'jperez',
        }
        await procesaRegistro({
            registro,
            email: 'email_col',
            timezone: 'tz_col',
            languages: 'lang_col',
            password: 'pass_col',
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        const command = mockExecute.mock.calls[0][0]
        expect(command).toContain('-e')
        expect(command).toContain('user@example.com')
        expect(command).toContain('-t')
        expect(command).toContain('America/Mexico_City')
        expect(command).toContain('-l')
        expect(command).toContain('es')
        expect(command).toContain('-p')
        expect(command).toContain('secret')
        expect(command).toContain('--bcrypt')
    })

    it('omits optional args when those columns are absent from record', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        const command = mockExecute.mock.calls[0][0]
        expect(command).not.toMatch(/ -e /)
        expect(command).not.toMatch(/ -t /)
        expect(command).not.toMatch(/ -l /)
    })

    it('throws "Usuario no definido" when usuario column is absent from record', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez' }
        await expect(procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })).rejects.toThrow('Usuario no definido')
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('always includes --bcrypt flag', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        expect(mockExecute.mock.calls[0][0]).toContain('--bcrypt')
    })

    it('returns raw stdout from executeProcess', async () => {
        mockExecute.mockResolvedValue('Created user. password abc123\n')
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        const result = await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        expect(result).toBe('Created user. password abc123\n')
    })
})

describe('password regex (route handler logic)', () => {
    it('capture group 1 extracts token only — not the full match (regression guard for matched[1] fix)', () => {
        const stdout = 'Created user. password abc123\n'
        const matched = /password\s+(\w+)/.exec(stdout)
        expect(matched).not.toBeNull()
        expect(matched![1]).toBe('abc123')
        expect(matched![0]).toBe('password abc123')
    })

    it('returns null when stdout has no password token', () => {
        const matched = /password\s+(\w+)/.exec('User created successfully')
        expect(matched).toBeNull()
    })
})
