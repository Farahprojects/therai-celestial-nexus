-- Update subscription_cancelled email template
-- Remove Plan field and ensure support link redirects to contact page

UPDATE public.email_notification_templates
SET
  body_html = '<div style="font-family: ''GT Sectra'', serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e8e8e8; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #000; margin: 0; font-size: 32px; font-weight: 400; font-family: ''GT Sectra'', serif;">Therai</h1>
    </div>
    <div style="margin-bottom: 30px;">
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-family: Arial, sans-serif;">Subscription Cancelled</h2>
      <p style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif;">Your Therai subscription has been cancelled. We''re sorry to see you go.</p>
    </div>
    <div style="color: #555; line-height: 1.6; font-size: 16px; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
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
  body_text = 'Subscription Cancelled\n\nYour Therai subscription has been cancelled. We''re sorry to see you go.\n\nCancelled: {{cancellation_date}}\nAccess Until: {{access_until}}\n\nYour subscription access will remain active until {{access_until}}. After this date, you will lose access to premium features.\n\nWe''d love to hear your feedback. Is there anything we could have done better?\nShare feedback: https://therai.co/support\n\nThis is an automated cancellation confirmation. Please do not reply directly to this email.\n\n© 2025 Therai. All rights reserved.',
  updated_at = now()
WHERE template_type = 'subscription_cancelled';







