# 0003: Razorpay and Stripe behind one interface

Status: accepted, 2026-10-15

## Decision

`PaymentProvider` interface with two adapters. Razorpay handles INR (UPI, cards, netbanking, wallets). Stripe handles other currencies. The provider is chosen per booking currency, and either can be disabled by leaving its keys empty.

Owners are paid out from our account. `payouts` records what is owed per confirmed stay booking after check in. Automated split payments (Razorpay Route, Stripe Connect) are a later change and do not affect the booking flow.
