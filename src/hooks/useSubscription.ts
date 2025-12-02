import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useSubscription() {
  const [loading, setLoading] = useState(false)

  const createCheckout = async (priceId: string, successUrl?: string, cancelUrl?: string) => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No session found')
      }

      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          priceId,
          successUrl,
          cancelUrl
        }
      })

      if (error) {
        throw new Error(error.message || 'Failed to create checkout')
      }

      const { url } = data
      
      // Redirect to Stripe Checkout
      window.location.href = url
      
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    createCheckout,
    loading
  }
}