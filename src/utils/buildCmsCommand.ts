import shellescape from "shell-escape"

export function buildCmsCommand(tool: 'cmsAddUser' | 'cmsAddParticipation', args: string[]): string {
    const escaped = shellescape(args).replace(/'""'/g, '""')
    const envScript = process.env.CMS_ENV_SCRIPT
    if (envScript) {
        return `. ${shellescape([envScript])} && ${tool} ${escaped}`
    }
    return `${tool} ${escaped}`
}
