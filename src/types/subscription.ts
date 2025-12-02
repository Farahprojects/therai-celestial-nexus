
export interface UserSubscriptionData {
  id: string;
  user_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  has_starter_plan: boolean;
  has_growth_plan: boolean;
  has_professional_plan: boolean;
  has_relationship_compatibility: boolean;
  has_yearly_cycle: boolean;
}

export interface UserData {
  id: string;
  email: string;
  plan_type: string;
  api_key: string | null;
  api_calls_count: number;
  calls_limit: number;
  status: string;
}
