import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../utils/executeProcess', () => ({
    executeProcess: vi.fn(),
}))

import { procesaRegistro } from '../../controllers/addParticipation'
import { executeProcess } from '../../utils/executeProcess'

const mockExecute = vi.mocked(executeProcess)

const BASE = { contest_col: '1', user_col: 'jperez' }

beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue(undefined as any)
})

describe('procesaRegistro (addParticipation)', () => {
    it('throws when contest column maps to a non-numeric value', async () => {
        await expect(procesaRegistro({
            registro: { contest_col: 'not-a-number', user_col: 'jperez' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('concurso')
    })

    it('throws "Concurso no definido" when contest column is absent from record', async () => {
        await expect(procesaRegistro({
            registro: { user_col: 'jperez' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('Concurso no definido')
    })

    it('throws "Usuario no definido" when usuario column is absent from record', async () => {
        await expect(procesaRegistro({
            registro: { contest_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('Usuario no definido')
    })

    it('adds --hidden when oculto is "true"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: 'true' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][0]).toContain('--hidden')
    })

    it('adds --hidden when oculto is "1"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][0]).toContain('--hidden')
    })

    it('does not add --hidden when oculto is "false"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: 'false' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][0]).not.toContain('--hidden')
    })

    it('does not add --hidden when oculto is "0"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: '0' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][0]).not.toContain('--hidden')
    })

    it('throws for invalid oculto value "yes"', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, oculto_col: 'yes' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })).rejects.toThrow('oculto')
    })

    it('adds --unrestricted when sin_restricciones is "true"', async () => {
        await procesaRegistro({
            registro: { ...BASE, sr_col: 'true' },
            contest: 'contest_col',
            usuario: 'user_col',
            sin_restricciones: 'sr_col',
        })
        expect(mockExecute.mock.calls[0][0]).toContain('--unrestricted')
    })

    it('adds --unrestricted when sin_restricciones is "1"', async () => {
        await procesaRegistro({
            registro: { ...BASE, sr_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
            sin_restricciones: 'sr_col',
        })
        expect(mockExecute.mock.calls[0][0]).toContain('--unrestricted')
    })

    it('throws for non-numeric tiempo_retraso with "tiempo retraso" in message', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, tr_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_retraso: 'tr_col',
        })).rejects.toThrow('tiempo retraso')
    })

    it('throws for non-numeric tiempo_extra with "tiempo extra" in message (regression: not "tiempo retraso")', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, te_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_extra: 'te_col',
        })).rejects.toThrow('tiempo extra')
    })

    it('tiempo_extra error does not say "tiempo retraso" (copy-paste regression guard)', async () => {
        const error = await procesaRegistro({
            registro: { ...BASE, te_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_extra: 'te_col',
        }).catch(e => e as Error)
        expect(error.message).not.toMatch('tiempo retraso')
    })
})
