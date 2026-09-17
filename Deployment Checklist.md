# Deployment Checklist

## Required server configuration

Configure `RESEND_API_KEY`, `DELIVERY_WORKER_AUTH`, `DELIVERY_FROM_ADDRESS`, `PRIVACY_CONSENT_VERSION`, and `DEPLOYMENT_URL` in the deployment secret manager. Do not put these values into client-exposed environment variables or commit them to Git.

## Sender and contact verification

Verify the Resend sender domain or address before enabling delivery. Implement the account email verification endpoint, send the six-digit code through the server-only Resend adapter, expire codes after fifteen minutes, cap attempts, and invalidate older requests when a new request is created.

## Worker protection

Run the delivery worker only in a server-side background context. Require the worker authorization secret, record outbox attempts and provider message IDs, apply bounded retries, and preserve failure details without storing provider secrets in logs.

## Privacy and operations

Record the current privacy-consent version, document email retention and unsubscribe behavior, review the provider’s data-processing terms, test in staging first, and perform one controlled production delivery to a verified account. Confirm that provider health, queue depth, failed attempts, and contact revocation are observable.

## Current repository state

This repository contains adapters and readiness checks but is intentionally not live-configured. No real credentials were available for this task, so activation remains blocked until an operator completes the steps above.
