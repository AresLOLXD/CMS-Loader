import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processRecords } from '../../utils/processRecords'
import type { Request, Response } from 'express'

function makeReq(registros?: Record<string, string>[]) {
    const session: Record<string, unknown> = { registros, columnas: ['col'] }
    return {
        req: { session: session as any, body: {} } as unknown as Request,
        session,
    }
}

function makeRes() {
    return {
        setHeader: vi.fn(),
        end: vi.fn(),
        redirect: vi.fn(),
    } as unknown as Response
}

describe('processRecords', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('redirects when registros is undefined', async () => {
        const { req } = makeReq(undefined)
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: vi.fn(),
        })
        expect((res as any).redirect).toHaveBeenCalledWith('upload.html')
        expect((res as any).end).not.toHaveBeenCalled()
    })

    it('sends CSV with Content-Type and filename in Content-Disposition', async () => {
        const { req } = makeReq([{ col: 'a' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async () => 'ok',
        })
        expect((res as any).setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv')
        expect((res as any).setHeader).toHaveBeenCalledWith(
            'Content-Disposition',
            expect.stringContaining('out.csv'),
        )
    })

    it('includes Extra value in CSV when processor returns a string', async () => {
        const { req } = makeReq([{ col: 'a' }, { col: 'b' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async (registro) => `result-${registro['col']}`,
        })
        const csv = (res as any).end.mock.calls[0][0] as string
        expect(csv).toContain('result-a')
        expect(csv).toContain('result-b')
    })

    it('does not add a row when processor returns void', async () => {
        const { req } = makeReq([{ col: 'a' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async () => undefined,
        })
        const csv = (res as any).end.mock.calls[0][0] as string
        expect(csv).not.toContain('"2"')
    })

    it('adds error message row when processor throws an Error', async () => {
        const { req } = makeReq([{ col: 'a' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async () => { throw new Error('something went wrong') },
        })
        const csv = (res as any).end.mock.calls[0][0] as string
        expect(csv).toContain('something went wrong')
    })

    it('uses fallback message when processor throws a non-Error', async () => {
        const { req } = makeReq([{ col: 'a' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async () => { throw 'not an error object' },
        })
        const csv = (res as any).end.mock.calls[0][0] as string
        expect(csv).toContain('Hubo un error procesando la fila')
    })

    it('output rows are sorted ascending by Indice for mixed success/failure', async () => {
        const { req } = makeReq([{ n: '1' }, { n: '2' }, { n: '3' }])
        const res = makeRes()
        let call = 0
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async (r) => {
                call++
                if (call === 2) throw new Error('fail')
                return `ok-${r['n']}`
            },
        })
        const csv = (res as any).end.mock.calls[0][0] as string
        const rows = csv.split('\n').filter(Boolean).slice(1)
        const indices = rows.map(r => parseInt(r.split(',')[0].replace(/"/g, ''), 10))
        expect(indices).toEqual([...indices].sort((a, b) => a - b))
    })

    it('clears session.registros and session.columnas after sending response', async () => {
        const { req, session } = makeReq([{ col: 'a' }])
        const res = makeRes()
        await processRecords(req, res, {
            redirectTo: 'upload.html',
            filename: 'out.csv',
            processor: async () => 'ok',
        })
        expect(session['registros']).toBeUndefined()
        expect(session['columnas']).toBeUndefined()
    })
})
