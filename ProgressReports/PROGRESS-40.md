# OTP email reference preparation — October 19, 2026

## Follow-up: live template applied

The EmailJS dashboard became accessible during the follow-up. Updated the existing template content and subject, saved, and verified persistence after reload. Static logo upload was blocked by the account's subscription limit. The live header uses the brand name without a broken image until a public HTTPS logo URL or embedded attachments are available; repository HTML retains the intended CID logo. The user confirmed the noreply mailbox still needs setup. The connected service remains personal Gmail; no sender spoofing, paid upgrade, DNS changes or test emails were performed. Focused provider/recovery tests passed again: 24/24.

## Scope and current status

- Prepared backend/email-templates/otp.html to reproduce the supplied reference layout: green #86E08B header/footer, navy #0F172A body, inset #0B0F15 panel, brand/logo and large copyable six-digit OTP. Added explicit expiry, single-use/security copy and a short automated-message footer; removed conflicting duration and placeholder-company wording from the prepared design.
- Uses inline, table-based email HTML and a responsive adjustment at 480px. Logo references the existing physiquequest-icon.png as a static embedded EmailJS CID, avoiding a localhost/relative image URL.
- PasswordRecoveryService passes the stored account name to EmailDeliveryProvider; EmailJS receives name along with existing email/passcode/time. Shared code expiry, verification, rate limits, credential configuration, delivery failure handling and legacy delivery payload stay unchanged. Existing templates ignore the additional name parameter safely.
- Added provider setup instructions, updated environment example/backend README and relevant design/backend/procedure guidance. Corrected backend README's stale 30-minute expiry to the implemented 10-minute policy.

## Verification

- Updated provider/recovery assertions first and observed three expected failures for missing name propagation; then implemented the minimal parameter change.
- Focused provider/recovery tests: 24/24 passed. Full backend suite: 366/366 across 46 files passed. Backend production build passed.
- Synthetic desktop 740px and phone 320px HTML previews verified resolved variables, loaded logo, six-digit code and no horizontal overflow. Inspected both screenshots. Previews are local artifacts under ignored backend/email-templates/preview; they contain synthetic sample values only.
- git diff --check passed. No dependencies, commits or pushes.

## Activation still required

The EmailJS dashboard currently requires sign-in. API send credentials do not edit the provider's saved template. The live template HTML has NOT been changed and its CID logo has NOT been uploaded; user sign-in is required to apply both. A request for that access was presented after preparing the concrete design.

The requested branded From identity requires an authorized mailbox/domain in the connected email service; .env keys alone do not create or verify noreply@physiquequest.com. No From spoofing, account settings, DNS changes, live OTP sends or recipient inbox checks were performed. Checklist live-delivery marks remain unchanged.
