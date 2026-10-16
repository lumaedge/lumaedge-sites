import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadLocalEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return out
}

export function envValue(key: string): string | undefined {
  return process.env[key] ?? loadLocalEnv()[key]
}

export function e2eMailbox(): { address: string; domain: string } {
  const address = envValue('E2E_MAILBOX')
  if (!address) {
    throw new Error(
      'E2E_MAILBOX is not set. Add E2E_MAILBOX=<any real mailbox> to .env.local; Supabase rejects signups on domains without MX records.'
    )
  }
  const domain = address.split('@')[1]
  if (!domain) throw new Error('E2E_MAILBOX is not a valid address')
  return { address, domain }
}

export async function promoteToAgency(email: string): Promise<void> {
  const url = envValue('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = envValue('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('Missing Supabase env for admin client')

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError
  const user = list.users.find((u) => u.email === email)
  if (!user) throw new Error(`Auth user not found for ${email}`)

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'agency' })
    .eq('user_id', user.id)
  if (error) throw error
}
