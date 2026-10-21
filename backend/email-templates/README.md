# PhysiqueQuest OTP email — dashboard-managed

## Source of truth

The active path is **A**: EmailJS renders its saved dashboard template. `EmailDeliveryProvider.sendPasswordReset()` in `backend/src/providers/email-delivery.provider.ts` selects EmailJS when `MAIL_PROVIDER` is unset and EmailJS settings exist; `sendWithEmailJs()` posts JSON to `https://api.emailjs.com/api/v1.0/email/send`. `PasswordRecoveryService.request()` calls it for password resets and signed-in password changes. There is no frontend EmailJS SDK/sendForm call or inline HTML in this request.

Configuration observed October 21, 2026: `SERVICE_ID=service_pdqqhio`, `TEMPLATE_ID=template_a9s1vuh`; aliases `EMAILJS_SERVICE_ID` and `EMAILJS_TEMPLATE_ID` are accepted. No keys are included here. The running development status endpoint reports EmailJS settings present and no legacy endpoint. `MAIL_PROVIDER` is unset, so its adapter override is inactive. A supported MAIL_PROVIDER takes precedence when configured; the legacy HTTP endpoint is used only when EmailJS is not configured.

| Template field | Value supplied by the send call |
| --- | --- |
| `{{email}}` | Recipient address; use in To Email |
| `{{name}}` | First part of the stored name; fallback `there` |
| `{{passcode}}` | Generated six-digit code, preserved as a string |
| `{{time}}` | `10 minutes`, from RECOVERY_CODE_VALIDITY_MINUTES |

`backend/email-templates/otp.html` is the old dark reference copy. It is not imported, read or uploaded by runtime code. It remains historical; **do not paste it**. Earlier documentation claiming the live dashboard had been updated was not evidence of a saved template or inbox verification.

The replacement files are [HTML](../../emails/otp-template.html) and [plain text](../../emails/otp-template.txt). Editing them does not update EmailJS. OTP generation, expiry, sending behavior and backend templates are unchanged by this task.

## Apply in EmailJS

1. **Email Templates → select template_a9s1vuh → Content → HTML code editor (`<>`)**. Replace the entire HTML with `emails/otp-template.html`, then **Save**. Do not paste HTML into the rich-text view as ordinary text.
2. Set **Subject** to `Reset your password`, **To Email** to `{{email}}`, and **From Name** to `PhysiqueQuest`. Keep the authenticated sender associated with `service_pdqqhio`; do not invent an unverified sender. Leave CC and BCC empty.
3. If a plain-text content field is available, paste `emails/otp-template.txt` there. Otherwise retain it as the fallback copy; do not append it to the HTML body. Save again.
4. The supplied HTML has no EmailJS branding line. Remove that line if editable in Content. If EmailJS injects it, footer removal is a paid-plan white-label feature; local HTML cannot remove provider-injected branding. Do not upgrade automatically.
5. Press **Test**, select `service_pdqqhio`, and enter your own recipient as `email`, a test first name as `name`, `012345` as `passcode`, and `10 minutes` as `time`. Send the test. This synthetic code checks formatting only and will not reset an account.
6. Check the newest message in Gmail desktop and Gmail mobile. Confirm subject/heading, small logo, one row `012345` including its leading zero, and `This code expires in 10 minutes and can be used once.` Check narrow-screen fit, blocked-image fallback and branding. Then request a real app code to confirm the real first name, six digits and expiry match; never log/share that code.

The logo uses the existing public HTTPS Cloudinary asset, not a local path or base64 attachment. Clients may block remote images or transform colors in dark mode; Gmail rendering requires a real inbox check. No dark section, colored band, flexbox, grid or script is authored.

## Verification status

Local synthetic rendering/variable checks are recorded in docs/checklist.md. Dashboard Save/Test and Gmail desktop/mobile verification were **not performed**: browser access was disabled in Work settings, no connected EmailJS/Gmail interface was available, and no recipient was supplied in this request. No real email was sent and no live template update is claimed.

Official guidance: [template fields](https://www.emailjs.com/docs/tutorial/creating-email-template/), [escaped variables](https://www.emailjs.com/docs/user-guide/dynamic-variables-templates/), [branding and plan limits](https://www.emailjs.com/pricing/).
