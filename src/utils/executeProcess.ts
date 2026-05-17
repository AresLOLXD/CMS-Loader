import { exec } from "child_process"

export async function executeProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`${err.message}${stderr ? `\nstderr: ${stderr}` : ""}`))
                return
            }
            resolve(stdout)
        })
    })
}
