# Subscription Plans: Costs, Pricing & Profit Margins

## Overview
This document tracks the cost structure, pricing, and profit margins for all Therai subscription plans.

---

## 📊 Plan Comparison Table

| Plan | Price/Month | Est. Cost/User | Gross Margin | Margin % | Target User |
|------|-------------|----------------|--------------|----------|-------------|
| **Free** | $0 | ~$0.20 | -$0.20 | -∞% | Trial users |
| **Plus** | $8 | $1.21 | $6.79 | 85% | Budget-conscious |
| **Growth** | $10 | $2.02 | $7.98 | 80% | Regular users |
| **Premium** | $18 | Variable | ~$15+ | 83% | Power users |

---

## 💰 Detailed Cost Breakdown

### Free Plan
**Monthly Cost per Active User**: ~$0.20

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| LLM tokens | Light chat only | Variable | $0.20 |
| Voice (STT) | 2 minutes | ~$0.006/min | $0.01 |
| Images | 0 | $0.02/image | $0.00 |
| **Total** | | | **$0.21** |

**Notes**:
- Free users have 7-day trial, then limited to Together Mode only
- No image generation access
- 2 minutes of voice transcription total
- Primary purpose: Lead generation and conversion funnel

---

### Plus Plan ($8/month) 💎 NEW
**Monthly Cost per Power User**: ~$1.21

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Voice (STT) | 5 minutes | ~$0.006/min | $0.03 |
| Voice (TTS) | ~5 minutes | ~$0.016/min | $0.08 |
| Images | 1/day = 30/month | ~$0.02/image | $0.60 |
| LLM tokens | Light-moderate use | Variable | $0.50 |
| **Total** | | | **$1.21** |

**Profit Margin**: $8.00 - $1.21 = **$6.79 per user (85% margin)**

**Features**:
- ✅ Unlimited AI conversations
- ✅ Together Mode (2-person sessions)
- ✅ Premium HD Voice (5 min/month)
- ✅ Image generation (1/day)
- ✅ Unlimited folders & sharing

**Target Audience**:
- Budget-conscious users
- Light-to-moderate feature usage
- Price-sensitive market segment

**Use Case**: A/B test vs Growth plan

---

### Growth Plan ($10/month)
**Monthly Cost per Power User**: ~$2.02

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Voice (STT) | 10 minutes | ~$0.006/min | $0.06 |
| Voice (TTS) | ~10 minutes | ~$0.016/min | $0.16 |
| Images | 3/day = 90/month | ~$0.02/image | $1.80 |
| LLM tokens | Moderate use | Variable | $0.00* |
| **Total Fixed Costs** | | | **$2.02** |

**Profit Margin**: $10.00 - $2.02 = **$7.98 per user (80% margin)**

*LLM token costs are variable but typically low due to:
- Context caching (reduces costs by ~80%)
- Efficient prompt engineering
- Conversation summaries

**Features**:
- ✅ Unlimited AI conversations
- ✅ Together Mode (2-person sessions)
- ✅ Premium HD Voice (10 min/month)
- ✅ Image generation (3/day)
- ✅ Unlimited folders & sharing

**Target Audience**:
- Regular users with daily habits
- Moderate voice and image usage
- Core revenue driver

---

### Premium Plan ($18/month)
**Monthly Cost per Power User**: Variable ($2-$5+)

| Feature | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| Voice (STT) | Unlimited | ~$0.006/min | Variable |
| Voice (TTS) | Unlimited | ~$0.016/min | Variable |
| Images | Unlimited | ~$0.02/image | Variable |
| LLM tokens | Heavy use | Variable | Variable |
| **Estimated Total** | | | **$2-$5+** |

**Profit Margin**: $18.00 - ~$3.00 = **~$15 per user (83% margin)**

**Features**:
- ✅ Everything in Growth
- ✅ Unlimited voice conversations
- ✅ Unlimited image generation
- ✅ Priority support
- ✅ Early access to new features

**Target Audience**:
- Power users
- Heavy voice users (>10 min/month)
- Image generation enthusiasts (>3/day)
- Users who value unlimited access

**Cost Protection**:
- Most users stay within reasonable limits
- Heavy users justify the $18 price point
- Can implement soft throttling if needed (e.g., quality degradation after extreme usage)

---

## 📈 Revenue Projections

### Scenario: 1,000 Paid Subscribers

| Plan | Users | Price | Monthly Revenue | Est. Cost | Gross Profit | Margin |
|------|-------|-------|-----------------|-----------|--------------|--------|
| Plus | 200 | $8 | $1,600 | $242 | $1,358 | 85% |
| Growth | 600 | $10 | $6,000 | $1,212 | $4,788 | 80% |
| Premium | 200 | $18 | $3,600 | $600 | $3,000 | 83% |
| **Total** | **1,000** | | **$11,200** | **$2,054** | **$9,146** | **82%** |

**Key Insights**:
- High overall margin (~82%) across all plans
- Growth plan is the volume driver
- Premium plan has best absolute profit per user
- Plus plan maximizes margin percentage (85%)

---

## 🎯 A/B Test: Plus vs Growth

### Conversion Rate Scenarios

**Scenario A: Plus Converts Better**
- Plus @ $8: 12% conversion rate
- Growth @ $10: 8% conversion rate
- **Winner**: Plus (higher conversion offsets lower price)

**Scenario B: Growth Converts Better**
- Plus @ $8: 8% conversion rate  
- Growth @ $10: 10% conversion rate
- **Winner**: Growth (higher LTV wins)

**Scenario C: Equal Conversion**
- Both: 10% conversion rate
- **Winner**: Growth (better LTV: $10 vs $8)

### Break-Even Analysis

**Question**: How much higher does Plus conversion need to be?

```
Growth LTV = $10/month × Average lifetime (assume 10 months) = $100
Plus LTV = $8/month × 10 months = $80

To break even:
Plus conversion × $80 = Growth conversion × $100
Plus conversion = Growth conversion × 1.25

If Growth converts at 10%, Plus needs 12.5% to break even
```

**Recommendation**: Run A/B test for 2-4 weeks, then compare:
- Conversion rates
- Churn rates
- Usage patterns
- Total revenue

---

## 💡 Optimization Strategies

### Cost Reduction
1. **Context Caching**: Already implemented, saves ~80% on LLM costs
2. **Batch Processing**: Fire-and-forget for non-critical operations
3. **Efficient Prompts**: Minimal token usage
4. **CDN for Images**: Reduce storage costs (already using Supabase Storage)

### Revenue Growth
1. **Annual Plans**: Offer 20% discount (2 months free) → reduces churn
2. **Team Plans**: $8/user/month for 5+ users (Plus pricing, bulk revenue)
3. **Add-ons**: Extra voice minutes ($3 for 5 min), extra images ($2 for 10)

### Margin Improvement
1. **Tiered Pricing Psychology**: Plus @ $8 makes Growth @ $10 feel like a good deal
2. **Premium Upsell**: Show unlimited benefits when users hit limits
3. **Feature Bundling**: Keep core features behind paywall (voice, images)

---

## 🔍 Monitoring & Analytics

### Key Metrics to Track

**Per Plan**:
- Monthly Recurring Revenue (MRR)
- Average Revenue Per User (ARPU)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- LTV:CAC Ratio (target: 3:1 or better)
- Churn rate
- Feature usage (voice minutes, images, chat messages)

**Cost Metrics**:
- Cost per user per month
- Gross margin per plan
- Cost per feature (voice, images, LLM)

**SQL Query for Tracking**:
```sql
-- Monthly plan performance
SELECT 
  subscription_plan,
  COUNT(*) as active_users,
  SUM(CASE 
    WHEN subscription_plan = '8_monthly' THEN 8.00
    WHEN subscription_plan = '10_monthly' THEN 10.00
    WHEN subscription_plan = '18_monthly' THEN 18.00
  END) as monthly_revenue,
  -- Add estimated costs here
FROM profiles
WHERE subscription_active = true
  AND subscription_status = 'active'
GROUP BY subscription_plan;
```

---

## 🚀 Recommended Strategy

### Phase 1: A/B Test (Weeks 1-4)
- Split new signups 50/50 between Plus and Growth
- Track conversion rates and revenue
- Monitor feature usage patterns
- Analyze churn by plan

### Phase 2: Analysis (Week 5)
- Compare total revenue (conversion × price)
- Evaluate margin differences
- Review user feedback and support tickets
- Check for usage pattern differences

### Phase 3: Decision (Week 6)
**Option A: Plus Wins**
- Make Plus the default plan
- Keep Growth as "Popular" option
- Premium remains upsell

**Option B: Growth Wins**  
- Keep Growth as default
- Deprecate Plus or keep as limited offer
- Focus on Growth → Premium upsell

**Option C: Both Perform Well**
- Show all 3 plans to all users
- Position Plus as "Starter"
- Growth as "Most Popular"
- Premium as "Best Value"

---

## 📋 Summary

| Metric | Plus | Growth | Premium |
|--------|------|--------|---------|
| **Price** | $8/mo | $10/mo | $18/mo |
| **Cost** | $1.21 | $2.02 | ~$3.00 |
| **Margin** | $6.79 (85%) | $7.98 (80%) | ~$15 (83%) |
| **Voice** | 5 min | 10 min | Unlimited |
| **Images** | 1/day | 3/day | Unlimited |
| **Target** | Budget | Regular | Power |

**Best Overall Margin**: Plus (85%)  
**Best Absolute Profit**: Premium (~$15/user)  
**Best Volume Play**: Growth (balanced features + price)

---

**Last Updated**: 2025-11-12  
**Status**: Plus plan ready for A/B testing  
**Next Review**: 2 weeks after A/B test launch

