
// Email regex pattern for validation
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation - only requiring minimum 8 characters
export const passwordRegex = /^.{8,}$/;

export const validateEmail = (email: string): boolean => {
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return passwordRegex.test(password);
};

export const validatePasswordMatch = (password: string, confirmPassword: string): boolean => {
  return password === confirmPassword && password.length > 0;
};

// Updated password requirements - only length requirement
export const passwordRequirements = [
  { key: "length", text: "At least 8 characters", validate: (p: string) => p.length >= 8 },
];
