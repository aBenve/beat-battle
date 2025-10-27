/**
 * Maps Better Auth error messages to user-friendly text
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const message = error.message.toLowerCase();

  // Email/password sign in errors
  if (message.includes('invalid email') || message.includes('invalid credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (message.includes('user not found') || message.includes('no user found')) {
    return 'No account found with this email. Please sign up first.';
  }

  if (message.includes('wrong password') || message.includes('incorrect password')) {
    return 'Incorrect password. Please try again.';
  }

  // Sign up errors
  if (message.includes('email already exists') || message.includes('user already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (message.includes('weak password') || message.includes('password too short')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  if (message.includes('invalid email format')) {
    return 'Please enter a valid email address.';
  }

  // Network/connection errors
  if (message.includes('network') || message.includes('fetch failed')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // OAuth errors
  if (message.includes('oauth') || message.includes('provider')) {
    return 'Social authentication failed. Please try again or use email/password.';
  }

  // Generic fallback with the original message if it's not too technical
  if (error.message.length < 100 && !message.includes('prisma') && !message.includes('database')) {
    return error.message;
  }

  return 'Authentication failed. Please try again.';
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
  }

  if (password.length < 8) {
    return { isValid: true, message: 'Consider using a stronger password (8+ characters)' };
  }

  // Check for at least one number or special character
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  if (!hasNumberOrSpecial) {
    return { isValid: true, message: 'Consider adding numbers or special characters' };
  }

  return { isValid: true };
}
