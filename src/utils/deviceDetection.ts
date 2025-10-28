/**
 * Detects if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Returns the appropriate checkout flow type based on device
 * - Mobile devices: hosted (Stripe's hosted checkout with native wallet support)
 * - Desktop devices: payment_element (in-app Payment Element)
 */
export const getCheckoutFlowType = (): 'hosted' | 'payment_element' => {
  return isMobileDevice() ? 'hosted' : 'payment_element';
};

