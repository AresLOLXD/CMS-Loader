import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'
import { mkdirSync, readdirSync } from 'fs'
import analyzeCSVRouter from '../../controllers/analyzeCSV'

function createTestApp() {
    const app = express()
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }))
    app.use('/analyzeCSV', analyzeCSVRouter)
    return app
}

function uploadsFileCount(): number {
    try { return readdirSync('uploads/').length } catch { return 0 }
}

const app = createTestApp()

beforeAll(() => {
    try { mkdirSync('uploads/') } catch { /* already exists */ }
})

describe('POST /analyzeCSV', () => {
    it('returns 200 with columnas for a valid CSV', async () => {
        const res = await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('col1,col2\na,b\nc,d'), 'test.csv')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.columnas).toEqual(['col1', 'col2'])
    })

    it('returns 200 with all columns for a multi-column CSV', async () => {
        const res = await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('col1,col2,col3\na,b,c\nd,e,f'), 'test.csv')
        expect(res.status).toBe(200)
        expect(res.body.data.columnas).toEqual(['col1', 'col2', 'col3'])
    })

    it('returns 422 for empty CSV (headers only, no data rows)', async () => {
        const res = await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('col1,col2\n'), 'empty.csv')
        expect(res.status).toBe(422)
        expect(res.body.success).toBe(false)
        expect(res.body.message).toBe('CSV vacío o no válido')
    })

    it('returns 400 for a non-CSV file type', async () => {
        const res = await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('data'), { filename: 'test.jpg', contentType: 'image/jpeg' })
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    it('returns 400 with "Archivo no cargado" when no file is attached', async () => {
        const res = await request(app).post('/analyzeCSV')
        expect(res.status).toBe(400)
        expect(res.body).toMatchObject({ success: false, message: 'Archivo no cargado' })
    })

    it('cleans up temp file after successful request', async () => {
        const before = uploadsFileCount()
        await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('col1\na'), 'test.csv')
        expect(uploadsFileCount()).toBe(before)
    })

    it('cleans up temp file even when parsing returns 422', async () => {
        const before = uploadsFileCount()
        await request(app)
            .post('/analyzeCSV')
            .attach('archivo', Buffer.from('col1,col2\n'), 'empty.csv')
        expect(uploadsFileCount()).toBe(before)
    })
})
