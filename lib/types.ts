export type Role = 'agency' | 'client'

export type Profile = {
  id: string
  role: Role
}

export type Entitlement = {
  plan: 'none' | 'editing'
  status: 'active' | 'past_due' | 'canceled'
}

export type SiteStatus = 'draft' | 'live' | 'suspended'
