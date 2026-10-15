import Link from 'next/link'
import { requireProfile } from '@/lib/auth'

export default async function DashboardPage() {
  const profile = await requireProfile()
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-600">Role: {profile.role}</p>
      <p className="mt-4">
        <Link href="/dashboard/sites" className="underline">
          Sites
        </Link>
      </p>
    </div>
  )
}
