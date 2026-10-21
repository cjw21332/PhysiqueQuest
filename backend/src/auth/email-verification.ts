import { HttpException } from '@nestjs/common';

export type VerificationPrincipal = { emailVerified?: boolean; legacyEmailAccess?: boolean };
export function emailStatus(user: { emailVerified?: boolean; legacyEmailAccess?: boolean; authPolicyVersion?: number }) {
  return { emailVerified: user.emailVerified === true, legacyEmailAccess: user.legacyEmailAccess ?? user.authPolicyVersion !== 2 };
}
export function enforceVerification(user: VerificationPrincipal, path: string, env = process.env) {
  if (env.EMAIL_VERIFICATION_ENFORCED !== 'true' || user.emailVerified) return;
  const route = path.replace(/^\/api\/(?:v1\/)?/i, '').replace(/\/+$/, '').toLowerCase();
  if (/^auth\/(?:me|verification\/(?:request|confirm)|session\/(?:refresh|migrate)|logout(?:-all)?|sessions(?:\/[^/]+)?)$/.test(route) || route === 'profile') return;
  const sensitive = route.startsWith('auth/password-change/') || route === 'account/delete' || route === 'account/email';
  if (user.legacyEmailAccess && !sensitive) return;
  throw new HttpException({ statusCode: 403, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email to continue.', verificationRequired: true, verificationPath: '/verify-email' }, 403);
}
