# ziova Payments

The Stripe implementation planner was run and its hosted Checkout recommendation accepted on 2026-10-02. This is a direct digital beat store with one-time CAD payments, not a subscription or marketplace.

## Integration

- MP3 lease: $24.99 CAD. WAV lease: $34.99 CAD. Exclusive leases remain Instagram DM inquiries. Loops are free downloads after agreement to the loop terms.
- Customers sign in with a confirmed email before checkout. The server validates published beats, lease deliverables and fixed prices, then creates an order and Stripe-hosted Checkout Session. Dynamic payment methods are enabled through Stripe's dashboard; adaptive currency conversion is disabled to charge CAD.
- Upload one WAV in the admin dashboard: the browser creates a 320 kbps MP3 and stores both private lease files. The full generated MP3 is used for public playback. Old single-file/manual purchases still work. An old file does not automatically become an MP3 or WAV product: upload a WAV to enable both formats.
- Raw-body, signature-verified webhooks retrieve current Stripe state, verify order owner, amount, currency and line items, then grant purchases in a transaction. A database lock and unique order/product constraint prevent repeated grants. Failed processing returns HTTP 500 for Stripe retries.
- The authenticated return page invokes the same server fulfillment function for an owned pending order, independently verifying the payment with Stripe. A URL or client-supplied payment status alone never grants access. Webhooks remain required for customers who do not return, delayed payments and refunds. The return page polls order status; only paid orders clear the matching items from the cart. Purchased files appear in My Downloads with short-lived signed download links.
- Full refunds revoke that order's downloads. Partial refunds retain access. Refunds cannot be undone by an older payment event. A separate later purchase can grant access again.

## Credentials

Set these on the server, locally in `.env.local` and in the deployment environment. Never commit credentials or prefix them with `NEXT_PUBLIC_`.

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server key: `sk_test_` or `rk_test_` in sandbox; `sk_live_` or `rk_live_` in production |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the matching webhook endpoint |
| `SUPABASE_SECRET_KEY` | Server secret key for the yearofziova Supabase project |
| `SITE_URL` | `http://localhost:3000` locally; `https://www.yearofziova.com` on deployment (the canonical domain) |
| `STRIPE_LIVE_PAYMENTS` | Leave `false` until the live integration has been configured and verified |

Restricted keys must permit the Checkout Session, Product, and Price operations used to create Checkout, plus reads for Charges and PaymentIntents used for refunds. Missing permissions cause checkout or fulfillment failures. Keep live and sandbox purchase data separate or remove verified sandbox grants before launch. Updating `.env.local` does not update Vercel: set production environment variables and redeploy.

Hosted Checkout does not require a Stripe publishable key in the frontend. MCP account authorization does not supply your site's API key.

## Sandbox webhook

Created in **yearofziova sandbox**, account `acct_1UMF2hEI9Cu5u6qq`:

- Endpoint ID: `we_1UMKEhEI9Cu5u6qqPdHUbZRO`
- URL: `https://yearofziova.com/api/stripe/webhook`
- API version: `2026-09-30.endive` (Stripe SDK 23.0.0's version)
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`

The endpoint's secret was saved only in local `.env.local`. Copy it to the deployment's `STRIPE_WEBHOOK_SECRET`; the public endpoint cannot work until this code and the credentials are deployed.

For local payment testing, use Stripe CLI forwarding instead:

```sh
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the CLI's signing secret locally while forwarding. It differs from the deployed endpoint secret. Restore the endpoint secret for deployment.

## Live webhook

Created on 2026-10-05 in **yearofziova**, live account `acct_1UMJdBE0sGTMCleh`:

- Endpoint ID: `we_1UNGWdE0sGTMClehOoA5ByBF`
- URL: `https://www.yearofziova.com/api/stripe/webhook`
- API version: `2026-09-30.endive`
- Events: the same five payment/refund events listed for the sandbox endpoint above.

The live signing secret is saved only in ignored `.env.local`. Set that value as `STRIPE_WEBHOOK_SECRET` in Vercel's **Production** environment, alongside the live `STRIPE_SECRET_KEY`, `STRIPE_LIVE_PAYMENTS=true`, `SITE_URL=https://www.yearofziova.com`, and the Supabase server credentials. Redeploy after changing environment variables. The live endpoint and the restricted key's Checkout/Charge/PaymentIntent read permissions have been verified. Production webhook delivery and a real customer checkout remain unverified; the deployed route still reported “Webhook not configured” before these deployment changes.

## Verification before accepting real payments

1. Add server credentials, restart the dev server and upload at least one MP3/WAV lease file.
2. Sign in as a customer, pay in the sandbox, confirm the correct format appears in My Downloads, and verify another account cannot access it.
3. Verify a declined payment creates no downloads; test asynchronous payment completion, webhook retries, and a full refund.
4. Deployment must have the webhook route and matching signing secret. Confirm successful event delivery in Stripe Workbench.
5. For live payments, use a live server API key (`sk_live_` or `rk_live_`) and a separate live webhook endpoint/secret, and set `STRIPE_LIVE_PAYMENTS=true`. The live endpoint must target `https://www.yearofziova.com/api/stripe/webhook` directly and subscribe to the same events listed above. Complete Stripe account activation and configure your licensing/refund terms and applicable taxes before launch.

Automated tests cover price/input validation and database permissions, delivery isolation, duplicate fulfillment, mismatched payment rejection, refunds and repurchases. Payment end-to-end verification requires the merchant credentials and deliverables above.

References: [Hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted), [fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted), [webhooks](https://docs.stripe.com/webhooks), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).

## Isolated sandbox preview

The `codex/stripe-sandbox` branch adds two preview-only checks: Vercel Preview deployments reject live Stripe keys, and preview checkout accepts only the dedicated test customer's user ID. Production checkout behavior stays the same. The test customer's confirmed email, password and UUID are saved in ignored `.env.sandbox-test.local`; it has no admin membership.

Configure **Preview variables scoped to `codex/stripe-sandbox`**:

- `STRIPE_SECRET_KEY`: sandbox `rk_test_` or `sk_test_` server key.
- `STRIPE_LIVE_PAYMENTS=false`.
- `STRIPE_SANDBOX_USER_ID`: `TEST_USER_ID` from `.env.sandbox-test.local`.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`: existing project credentials.
- `SITE_URL`: the stable preview URL, without a trailing slash.
- `STRIPE_WEBHOOK_SECRET`: the signing secret of a **sandbox** webhook pointing to that preview URL's `/api/stripe/webhook`.

The webhook requires a publicly reachable route; if preview deployment protection is enabled, configure an appropriate preview-only automation bypass for webhook delivery. A return-page confirmation alone does not prove webhook delivery.

After redeploying with preview credentials, sign in with the dedicated test account. Complete Stripe Checkout with `4242 4242 4242 4242`, any future expiry and a three-digit CVC. Verify the purchased format, confirmation page, My Downloads and signed download, then repeat for the other format. Keep test grants on this dedicated account and do not use a real customer's login. Do not change Production environment variables for this test.
