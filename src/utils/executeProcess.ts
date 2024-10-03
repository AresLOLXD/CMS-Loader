
import { exec } from "child_process"

export async function executeProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (err, salida, salidaErr) => {
            if (err) {
                console.error("Comando error: ", err)
                reject(err)
                return
            }
            if (salidaErr) {
                console.error("Salida Error: ", salidaErr)
                reject(Error(salidaErr))
                return
            }

            console.log("Salida: ", salida)
            resolve(salida)
        })
    })
}