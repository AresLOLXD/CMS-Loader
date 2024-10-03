
import { exec } from "child_process"

export async function executeProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (err, salida, salidaErr) => {
            if (err) {
                reject(err)
                return
            }

            console.log("Salida Error: ", salidaErr)
            console.log("Salida: ", salida)
            resolve(salida)
        })
    })
}