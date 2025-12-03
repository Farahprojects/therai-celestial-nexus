import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { safeConsoleError } from '@/utils/safe-logging';
interface UserProfile {
  id: string
  email: string
  email_verified: boolean
  subscription_active: boolean
  subscription_plan: string
  subscription_status: string
  stripe_customer_id?: string
  created_at: string
  last_seen_at: string
}

interface PaymentMethod {
  id: string
  card_brand: string
  card_last4: string
  exp_month: number
  exp_year: number
  active: boolean
  last_charge_at?: string
  last_charge_status?: string
  last_invoice_amount_cents?: number
  last_invoice_currency?: string
  last_receipt_url?: string
  next_billing_at?: string
  invoice_history?: Array<{
    id: string
    number: string
    amount_cents: number
    currency: string
    status: string
    charge_date: string
    receipt_url?: string
  }>
}

interface UserCredits {
  balance_usd: number
  last_updated: string
}

interface SettingsData {
  profile: UserProfile | null
  paymentMethod: PaymentMethod | null
  credits: UserCredits | null
  loading: boolean
  error: string | null
}

export function useSettingsData() {
  const { user } = useAuth()
  const [data, setData] = useState<SettingsData>({
    profile: null,
    paymentMethod: null,
    credits: null,
    loading: false,
    error: null
  })

  const fetchSettingsData = useCallback(async () => {
    if (!user) {
      setData(prev => ({ ...prev, loading: false, profile: null, paymentMethod: null, credits: null }))
      return
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }))

      // Fetch all data in parallel
      const [profileResult, paymentResult] = await Promise.all([
        // Fetch user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        
        // Fetch payment method
        supabase
          .from('payment_method')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle(),
        
        // Skip user credits as it's no longer used
        Promise.resolve({ data: null, error: null })
      ])

      setData({
        profile: profileResult.data,
        paymentMethod: paymentResult.data ? {
          ...paymentResult.data,
          id: String(paymentResult.data.id), // Convert number to string
          invoice_history: Array.isArray(paymentResult.data.invoice_history) ? 
            paymentResult.data.invoice_history as PaymentMethod['invoice_history'] : 
            []
        } : null,
        credits: null, // No longer using user credits
        loading: false,
        error: null
      })

    } catch (error) {
      safeConsoleError('Error fetching settings data:', error)
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load settings data'
      }))
    }
  }, [user])

  // Manual fetch function that components can call when needed
  const fetchOnDemand = useCallback(() => {
    if (user) {
      fetchSettingsData()
    }
  }, [user, fetchSettingsData])

  // Don't automatically fetch on user change - only when explicitly requested
  // useEffect(() => {
  //   fetchSettingsData()
  // }, [user])

  return {
    ...data,
    fetchData: fetchOnDemand,
    refetch: fetchOnDemand
  }
}