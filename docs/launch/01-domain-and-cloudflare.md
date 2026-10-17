# Launch 1: Domain and Cloudflare

**Time:** about 20 minutes. **Cost:** the domain's yearly price.

You'll end up with two addresses. These guides use `clientshield.example` in their place; use
your real domain wherever you see it.

- **`clientshield.example`**: the contractor app and landing page.
- **`admin.clientshield.example`**: the admin panel.

> **Ask your lawyer first** whether the name is clear to use (trademark search) before you buy
> the domain.

---

**Step 1 of 6.** Go to **https://dash.cloudflare.com/sign-up** and create an account with your own
email and password.

✅ **You should see:** the Cloudflare dashboard.

**Step 2 of 6.** Turn on two-step login for Cloudflare. Click your profile icon (top right),
then **My Profile**, then **Authentication**, then **Two-Factor Authentication**. Follow the steps
with your authenticator app.

✅ **You should see:** two-factor authentication turned on.

**Step 3 of 6.** In the left menu, click **Domain Registration**, then **Register Domains**.

**Step 4 of 6.** Search for the domain you want. Click **Purchase** and finish checking out. Turn
on **auto-renew** so it never expires.

✅ **You should see:** your domain listed under **Websites** (or **Domains**) with status
**Active**. This can take a few minutes.

> **Already own the domain somewhere else?** Click **Add a domain** instead. Cloudflare shows
> two "nameservers". Copy them into your old registrar's settings, then wait for the email saying
> the domain is active. This can take up to a day.

**Step 5 of 6.** Click your domain, then in the left menu **SSL/TLS**, then **Overview**. Choose
**Full (strict)**.

**Step 6 of 6.** In **SSL/TLS**, open **Edge Certificates**. Turn on **Always Use HTTPS**.

✅ **You should see:** both settings saved.

---

**Done.** Save in your password manager: the Cloudflare login, and the domain name.

Next: [Launch 2: Supabase production project](02-supabase-production.md).
