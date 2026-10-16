import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="grid gap-3">
        <h1 className="text-4xl font-bold tracking-tight">Website Builder</h1>
        <p className="max-w-xl text-lg text-slate-600">
          Brochure websites for small businesses, built from templates, edited block by
          block, and published to your own subdomain.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/signup">Get started</Link>} />
        <Button render={<Link href="/login">Sign in</Link>} variant="outline" />
      </div>
    </main>
  )
}