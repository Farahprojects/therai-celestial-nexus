-- Add payment-related email templates
-- Style matches existing templates: GT Sectra for headings, Arial for body, minimal design
-- Migration: 20250208000000_add_payment_email_templates.sql

INSERT INTO public.email_notification_templates (template_type, subject, body_html, body_text) VALUES
(
  'payment_method_updated',
  'Payment Method Updated',
  '<div style="font-family: ''GT Sectra'', serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e8e8e8; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #000; margin: 0; font-size: 32px; font-weight: 400; font-family: ''GT Sectra'', serif;">Therai</h1>
    </div>
    <div style="margin-bottom: 30px;">
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-family: Arial, sans-serif;">Payment Method Updated</h2>
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif;">This message confirms that the payment method for your Therai account has been updated.</p>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>Card Brand:</strong> {{card_brand}}</p>
      <p><strong>Card Number:</strong> •••• •••• •••• {{card_last4}}</p>
      <p><strong>Updated:</strong> {{date}}</p>
      <p><strong>If this was you:</strong> You''re all set. Your subscription will continue using this payment method.</p>
      <p><strong>If this wasn''t you:</strong> Please contact our support team immediately to secure your account.</p>
    </div>
    <div style="margin-top: 40px; background-color: #f9f9f9; padding: 20px; border-radius: 4px; text-align: center;">
      <p style="margin-bottom: 20px; color: #666; font-size: 15px; font-family: Arial, sans-serif;">Need help or didn''t make this change?</p>
      <a href="https://therai.co/support" style="background-color: #ffffff; color: #000; padding: 12px 25px; text-decoration: none; border: 2px solid #000; border-radius: 25px; font-weight: 500; display: inline-block; font-family: Arial, sans-serif;">Contact Support</a>
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; color: #999; font-size: 13px; text-align: center; font-family: Arial, sans-serif;">
      <p>This is an automated system message. Please do not reply directly to this email.</p>
      <p>&copy; 2025 Therai. All rights reserved.</p>
    </div>
  </div>',
  'Payment Method Updated\n\nThis message confirms that the payment method for your Therai account has been updated.\n\nCard Brand: {{card_brand}}\nCard Number: •••• •••• •••• {{card_last4}}\nUpdated: {{date}}\n\nIf this was you: You''re all set. Your subscription will continue using this payment method.\nIf this wasn''t you: Please contact our support team immediately to secure your account.\n\nNeed help? Visit https://therai.co/support\n\nThis is an automated system message. Please do not reply directly to this email.\n\n© 2025 Therai. All rights reserved.'
),
(
  'payment_failed',
  'Payment Failed - Action Required',
  '<div style="font-family: ''GT Sectra'', serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e8e8e8; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #000; margin: 0; font-size: 32px; font-weight: 400; font-family: ''GT Sectra'', serif;">Therai</h1>
    </div>
    <div style="margin-bottom: 30px;">
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-family: Arial, sans-serif;">Payment Failed</h2>
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif;">We were unable to process your subscription payment. Please update your payment method to continue your service.</p>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>Amount:</strong> {{amount}}</p>
      <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
      <p><strong>Attempted:</strong> {{date}}</p>
      <p><strong>Next Retry:</strong> {{retry_date}}</p>
      <p style="color: #000; font-weight: 500; margin-top: 20px;">Your subscription will remain active until {{retry_date}}. Please update your payment method to avoid interruption.</p>
    </div>
    <div style="text-align: center; margin: 40px 0;">
      <a href="https://therai.co/billing" style="background-color: #ffffff; color: #000; padding: 15px 30px; text-decoration: none; border: 2px solid #000; border-radius: 25px; font-weight: 500; display: inline-block; font-family: Arial, sans-serif; font-size: 16px;">Update Payment Method</a>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 14px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>What happened?</strong> Your payment could not be processed. This may be due to an expired card, insufficient funds, or a bank decline.</p>
      <p><strong>What to do:</strong> Update your payment method before {{retry_date}} to ensure uninterrupted service.</p>
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; color: #999; font-size: 13px; text-align: center; font-family: Arial, sans-serif;">
      <p>This is an automated payment notification. Please do not reply directly to this email.</p>
      <p>&copy; 2025 Therai. All rights reserved.</p>
    </div>
  </div>',
  'Payment Failed - Action Required\n\nWe were unable to process your subscription payment. Please update your payment method to continue your service.\n\nAmount: {{amount}}\nInvoice Number: {{invoice_number}}\nAttempted: {{date}}\nNext Retry: {{retry_date}}\n\nYour subscription will remain active until {{retry_date}}. Please update your payment method to avoid interruption.\n\nUpdate your payment method: https://therai.co/billing\n\nWhat happened? Your payment could not be processed. This may be due to an expired card, insufficient funds, or a bank decline.\nWhat to do: Update your payment method before {{retry_date}} to ensure uninterrupted service.\n\nThis is an automated payment notification. Please do not reply directly to this email.\n\n© 2025 Therai. All rights reserved.'
),
(
  'subscription_cancelled',
  'Your Therai Subscription Has Been Cancelled',
  '<div style="font-family: ''GT Sectra'', serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e8e8e8; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #000; margin: 0; font-size: 32px; font-weight: 400; font-family: ''GT Sectra'', serif;">Therai</h1>
    </div>
    <div style="margin-bottom: 30px;">
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-family: Arial, sans-serif;">Subscription Cancelled</h2>
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif;">Your Therai subscription has been cancelled. We''re sorry to see you go.</p>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>Plan:</strong> {{plan_name}}</p>
      <p><strong>Cancelled:</strong> {{cancellation_date}}</p>
      <p><strong>Access Until:</strong> {{access_until}}</p>
      <p>Your subscription access will remain active until {{access_until}}. After this date, you will lose access to premium features.</p>
    </div>
    <div style="margin-top: 40px; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; margin-bottom: 20px;">We''d love to hear your feedback. Is there anything we could have done better?</p>
      <div style="text-align: center;">
        <a href="https://therai.co/support" style="background-color: #ffffff; color: #000; padding: 12px 25px; text-decoration: none; border: 2px solid #000; border-radius: 25px; font-weight: 500; display: inline-block; font-family: Arial, sans-serif;">Share Feedback</a>
      </div>
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; color: #999; font-size: 13px; text-align: center; font-family: Arial, sans-serif;">
      <p>This is an automated cancellation confirmation. Please do not reply directly to this email.</p>
      <p>&copy; 2025 Therai. All rights reserved.</p>
    </div>
  </div>',
  'Subscription Cancelled\n\nYour Therai subscription has been cancelled. We''re sorry to see you go.\n\nPlan: {{plan_name}}\nCancelled: {{cancellation_date}}\nAccess Until: {{access_until}}\n\nYour subscription access will remain active until {{access_until}}. After this date, you will lose access to premium features.\n\nWe''d love to hear your feedback. Is there anything we could have done better?\nShare feedback: https://therai.co/support\n\nThis is an automated cancellation confirmation. Please do not reply directly to this email.\n\n© 2025 Therai. All rights reserved.'
),
(
  'payment_successful',
  'Payment Received - Thank You',
  '<div style="font-family: ''GT Sectra'', serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e8e8e8; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #000; margin: 0; font-size: 32px; font-weight: 400; font-family: ''GT Sectra'', serif;">Therai</h1>
    </div>
    <div style="margin-bottom: 30px;">
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-family: Arial, sans-serif;">Payment Received</h2>
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif;">Thank you for your payment. Your subscription has been renewed successfully.</p>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>Amount Paid:</strong> {{amount}}</p>
      <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
      <p><strong>Payment Date:</strong> {{date}}</p>
      <p><strong>Next Billing Date:</strong> {{next_billing_date}}</p>
    </div>
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{receipt_url}}" style="background-color: #ffffff; color: #000; padding: 15px 30px; text-decoration: none; border: 2px solid #000; border-radius: 25px; font-weight: 500; display: inline-block; font-family: Arial, sans-serif; font-size: 16px;">View Receipt</a>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 14px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
      <p><strong>Subscription Status:</strong> Active</p>
      <p>Your subscription is active and will automatically renew on {{next_billing_date}}. You can manage your subscription anytime in your account settings.</p>
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; color: #999; font-size: 13px; text-align: center; font-family: Arial, sans-serif;">
      <p>This is an automated payment receipt. Please do not reply directly to this email.</p>
      <p>&copy; 2025 Therai. All rights reserved.</p>
    </div>
  </div>',
  'Payment Received - Thank You\n\nThank you for your payment. Your subscription has been renewed successfully.\n\nAmount Paid: {{amount}}\nInvoice Number: {{invoice_number}}\nPayment Date: {{date}}\nNext Billing Date: {{next_billing_date}}\n\nView Receipt: {{receipt_url}}\n\nSubscription Status: Active\nYour subscription is active and will automatically renew on {{next_billing_date}}. You can manage your subscription anytime in your account settings.\n\nThis is an automated payment receipt. Please do not reply directly to this email.\n\n© 2025 Therai. All rights reserved.'
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();

