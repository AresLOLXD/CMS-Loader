
import { exec } from "child_process"

export async function executeProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (err, salida, salidaErr) => {
            if (err || salidaErr) {
                console.error("Comando error: ", err)
                console.error("Salida Error: ", salidaErr)
                reject(salidaErr ? salidaErr : err)
                return
            }
            resolve(salida)
        })
    })
}