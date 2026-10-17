# Launch 3: Email with Resend

**Time:** about 20 minutes. **Cost:** free up to 3,000 emails a month.

Supabase's built-in email is only for testing: it sends a few emails an hour from a Supabase
address. Resend sends sign-up, confirmation and password reset emails from **your** domain.

---

**Step 1 of 10.** Go to **https://resend.com/signup** and create an account. Turn on two-step login
in your Resend account settings.

**Step 2 of 10.** In Resend, click **Domains**, then **Add domain**. Type `mail.clientshield.example`
(using a `mail.` part keeps email settings separate from your website). Choose the **US** region.

✅ **You should see:** a list of DNS records (TXT and MX).

**Step 3 of 10.** If Resend offers **Auto configure** with Cloudflare, click it and allow it.
Otherwise, add each record yourself in Cloudflare. Go to **your domain**, then **DNS**, then
**Records**, then **Add record**. Copy the **Type**, **Name** and **Value** exactly from Resend.

**Step 4 of 10.** Back in Resend, click **Verify DNS records**.

✅ **You should see:** the domain status **Verified**. This can take a few minutes, sometimes up to
an hour.

**Step 5 of 10.** In Resend, click **API Keys**, then **Create API Key**:

- **Name:** `Supabase SMTP`
- **Permission:** **Sending access**
- **Domain:** `mail.clientshield.example`

Copy the key (starts with `re_`) **straight into your password manager** as "Resend SMTP key".

**Step 6 of 10.** In Supabase (your **production** project), go to **Authentication**, then
**Emails**, then **SMTP Settings**. Turn on **Enable custom SMTP** and fill in:

- **Sender email:** `no-reply@mail.clientshield.example`
- **Sender name:** `ClientShield`
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** paste the Resend key from Step 5

Click **Save**.

**Step 7 of 10.** Go to **Authentication**, then **Rate Limits**. Set **emails sent per hour** to
`100`. Save.

**Step 8 of 10.** Go to **Authentication**, then **Emails**, then **Templates**. Open **Confirm
signup**. Change the subject to `Confirm your ClientShield account`. Leave the link in the message
exactly as it is. Save.

**Step 9 of 10.** Do the same for **Reset Password** (subject `Reset your ClientShield password`)
and **Change Email Address** (subject `Confirm your new ClientShield email`).

**Step 10 of 10.** You'll test this in Guide 6, when you sign up on the live site.

---

## Optional: protect your domain from fake emails

In Cloudflare, go to **DNS**, then **Records**, then **Add record**:

- **Type:** `TXT`
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=quarantine; rua=mailto:you@yourmail.example` (put in your own email)

This tells email providers to distrust emails that pretend to be from your domain.

Next: [Launch 4: Deploy the backend](04-deploy-the-backend.md).
