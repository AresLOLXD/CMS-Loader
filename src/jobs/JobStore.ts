import { randomUUID } from "crypto"
import { CSVRecord } from "../utils"

interface Job {
    id: string
    status: 'pending' | 'running' | 'done' | 'error'
    total: number
    processed: number
    records: CSVRecord[]
    results: { Indice: number; Extra: string }[]
    columnas: string[]
    filename: string
    createdAt: Date
}

class JobStore {
    private jobs = new Map<string, Job>()

    create(records: CSVRecord[], columnas: string[]): Job {
        const id = randomUUID()
        const job: Job = {
            id,
            status: 'pending',
            total: records.length,
            processed: 0,
            records,
            results: [],
            columnas,
            filename: '',
            createdAt: new Date(),
        }
        this.jobs.set(id, job)
        return job
    }

    get(id: string): Job | undefined {
        return this.jobs.get(id)
    }

    update(id: string, patch: Partial<Job>): void {
        const job = this.jobs.get(id)
        if (job) Object.assign(job, patch)
    }

    delete(id: string): void {
        this.jobs.delete(id)
    }

    startTtlCleanup(): void {
        setInterval(() => {
            const cutoff = new Date(Date.now() - 60 * 60 * 1000)
            for (const [id, job] of this.jobs) {
                if (job.createdAt < cutoff) {
                    this.jobs.delete(id)
                }
            }
        }, 10 * 60 * 1000).unref()
    }
}

export const jobStore = new JobStore()
