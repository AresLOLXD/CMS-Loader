export interface FieldConfig {
  name: string
  label: string
  required?: boolean
}

export const fieldsConfig: Record<'users' | 'contest', FieldConfig[]> = {
  users: [
    { name: 'usuario', label: 'Usuario', required: true },
    { name: 'nombre', label: 'Nombre' },
    { name: 'apellidos', label: 'Apellidos' },
    { name: 'email', label: 'Email' },
    { name: 'timezone', label: 'Zona horaria' },
    { name: 'languages', label: 'Idiomas' },
    { name: 'password', label: 'Contraseña' },
  ],
  contest: [
    { name: 'usuario', label: 'Usuario', required: true },
    { name: 'contest', label: 'Concurso', required: true },
    { name: 'ip', label: 'IP' },
    { name: 'tiempo_retraso', label: 'Tiempo retraso' },
    { name: 'tiempo_extra', label: 'Tiempo extra' },
    { name: 'team', label: 'Equipo' },
    { name: 'oculto', label: 'Oculto' },
    { name: 'sin_restricciones', label: 'Sin restricciones' },
    { name: 'password', label: 'Contraseña' },
  ],
}
