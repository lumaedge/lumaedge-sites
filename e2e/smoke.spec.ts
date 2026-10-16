import { test, expect } from '@playwright/test'
import { e2eMailbox, promoteToAgency } from './helpers'

test('agency builds, publishes, client sees read-only', async ({ browser }) => {
  const stamp = Date.now()
  const { domain } = e2eMailbox()
  const email = `e2e-agency+${stamp}@${domain}`
  const slug = `e2e-${stamp}`
  const password = 'Test1234!@#'

  const agencyContext = await browser.newContext()
  const page = await agencyContext.newPage()

  await page.goto('/signup')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard')
  await promoteToAgency(email)

  await page.goto('/dashboard/sites/new')
  await page.fill('#name', 'E2E Business')
  await page.fill('#slug', slug)
  await page.selectOption('#template', 'trades')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard\/sites\//)
  const siteId = new URL(page.url()).pathname.split('/').pop() ?? ''

  await page.getByRole('button', { name: 'Edit Hero block' }).click()
  await page.getByLabel('Headline').fill('E2E headline live')
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 20000 })

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('live', { exact: true })).toBeVisible({ timeout: 20000 })

  const publicPage = await agencyContext.newPage()
  await publicPage.goto(`http://${slug}.localhost:3000`)
  await expect(publicPage.getByRole('heading', { level: 1 })).toContainText(
    'E2E headline live',
    { timeout: 20000 }
  )

  await publicPage.fill('input[name=name]', 'Visitor')
  await publicPage.fill('input[name=email]', 'visitor@example.com')
  await publicPage.fill('textarea[name=message]', 'Hello from e2e')
  await publicPage.click('button[type=submit]')
  await publicPage.waitForURL(`http://${slug}.localhost:3000/`)

  const clientContext = await browser.newContext()
  const clientPage = await clientContext.newPage()
  const clientEmail = `e2e-client+${stamp}@${domain}`
  await clientPage.goto('/signup')
  await clientPage.fill('#email', clientEmail)
  await clientPage.fill('#password', password)
  await clientPage.click('button[type=submit]')
  await clientPage.waitForURL('**/dashboard')

  await clientPage.goto(`http://${slug}.localhost:3000`)
  await expect(clientPage.getByRole('heading', { level: 1 })).toContainText(
    'E2E headline live'
  )

  const writeAttempt = await clientPage.request.put(
    `http://localhost:3000/api/sites/${siteId}/document`,
    {
      headers: { 'Content-Type': 'application/json' },
      data: { document: { seo: { title: 'Hijacked' }, theme: {}, blocks: [] } },
    }
  )
  expect([403, 404]).toContain(writeAttempt.status())

  await agencyContext.close()
  await clientContext.close()
})