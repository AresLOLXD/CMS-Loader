export function parseBoolFlag(value: string, fieldName: string): boolean {
    const lower = value.toLowerCase()
    if (lower === "true" || value === "1") return true
    if (lower === "false" || value === "0") return false
    throw new Error(`El valor ${value} para ${fieldName} no es un valor valido`)
}
