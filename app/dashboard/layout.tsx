import { requireProfile } from '@/lib/auth'
import { SignOutButton } from '@/components/sign-out-button'

export const instant = false

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireProfile()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <p className="font-semibold">Website Builder {profile.role === 'agency' ? '(Agency)' : ''}</p>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  )
}
