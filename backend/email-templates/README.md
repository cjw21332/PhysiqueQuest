# PhysiqueQuest OTP email

## Live status — October 19, 2026

The existing EmailJS template now has the reference layout, hosted system logo and the subject `Your PhysiqueQuest verification code`. The logo uses the user's public Cloudinary asset at `https://res.cloudinary.com/hkf3rsym/image/upload/f_png,q_auto/physiquequest-icon`. PNG delivery is explicit for email compatibility. No frontend deployment or EmailJS attachment upgrade is required.

Keep this Cloudinary asset publicly accessible. Localhost and local file paths cannot load in recipients' mail apps. Some email apps block remote images until the recipient allows them; the adjacent brand name remains readable.

The connected service is personal Gmail. The user confirmed that `noreply@physiquequest.com` is not yet set up; the authenticated Gmail sender remains active. Live inbox delivery has not been tested.

`otp.html` is the EmailJS template source. The layout follows the supplied email reference: green brand header, system logo, dark navy body, inset code card and green footer. The email-specific reference colors are #86E08B, #0F172A and #0B0F15. It uses inline/table layout with a narrow-screen adjustment rather than website CSS or JavaScript.

The backend already selects the live template using `TEMPLATE_ID` / `EMAILJS_TEMPLATE_ID`. Its API keys authorize sending; editing this file alone does **not** replace the template saved in EmailJS.

## Apply to the existing EmailJS template

1. Open the template matching the configured template ID in the EmailJS dashboard. Keep its service connection and ID.
2. Set Subject to `Your PhysiqueQuest verification code`, To Email to `{{email}}`, and From Name to `PhysiqueQuest`. Leave CC and BCC empty; never copy security codes to another recipient.
3. Replace the Content HTML with the complete contents of `otp.html`, using the source/code editor.
4. Keep the public Cloudinary image URL in the HTML. No attachment setup is needed. Do not use `/logo.jpg`, localhost, a local filesystem path or a data URL in a delivered email.
5. Preview with synthetic values: `email=member@example.test`, `name=Toji`, `passcode=123456`, `time=10 minutes`. Save the template. Inspect a real test email only in an authorized test mailbox before claiming inbox verification.

The backend supplies `email`, the stored account `name`, `passcode` and `time` on both reset and signed-in password-change requests. Double-brace variables escape HTML; do not change them to triple braces. Expiry comes from `RECOVERY_CODE_VALIDITY_MINUTES`; do not hard-code a different duration in the template. Keep the code out of the subject and preview text.

## Sender address

The email `name` parameter uses the first whitespace-separated part of the stored account name (for example, `Toji Fushiguro` becomes `Toji`). Blank names fall back to `there`. The full account name remains unchanged in storage. This applies to both password-reset and signed-in password-change emails after the updated backend is running.

The target identity is `PhysiqueQuest <noreply@physiquequest.com>`. Set that From Email only after the connected email service authorizes this mailbox/domain. A send API key does not create or verify a domain or mailbox. Until then, keep the service's authenticated sender; renaming it or adding a Reply-To address does not replace the actual Gmail From address. Domain verification and provider/account settings are external activation steps, not completed by this repository change.

Official EmailJS guidance: [template fields](https://www.emailjs.com/docs/tutorial/creating-email-template/), [embedded logo attachments](https://www.emailjs.com/docs/user-guide/embedded-images/), [escaped dynamic variables](https://www.emailjs.com/docs/user-guide/dynamic-variables-templates/).
