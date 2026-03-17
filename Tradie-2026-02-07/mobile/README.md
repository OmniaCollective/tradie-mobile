# TRADIE - Multi-Trade Job Management Platform

An automation-first mobile platform for solo tradespeople (plumbers, electricians, gardeners, cleaners) that eliminates admin work by letting customers self-serve quotes and bookings.

## Core Concept

When a customer calls or emails, the tradesperson sends them a booking link (one tap). The customer:
1. Selects their issue
2. Gets an instant quote
3. Accepts and books

The tradesperson gets notified and the job appears on their calendar - no interruptions while working.

## Multi-Trade Support

**Supported Trades:**
- **Plumber** - Blocked drains, leaking taps, burst pipes, boiler service, etc.
- **Electrician** - Faulty sockets, rewiring, consumer unit, circuit breaker trips, etc.
- **Gardener** - Lawn mowing, hedge trimming, patio cleaning, fencing, etc.
- **Cleaner** - House cleaning, deep clean, carpet clean, end of tenancy, etc.

**Setup:** On first launch, users select their trade. The app dynamically loads trade-specific job types and default pricing. All other features remain identical.

## Features

### Dashboard
- Current job with complete action
- Upcoming scheduled jobs
- Pending quotes awaiting approval
- To-do list (text notes)
- Quick stats (unpaid invoices, jobs this week)

### Calendar
- Monthly view with job indicators
- Daily job list
- Start job directly from calendar

### Invoices
- Auto-generated when jobs complete
- Send via Share sheet (SMS/email)
- Track paid/unpaid status
- Full quote breakdown

### Settings
- Business details
- Pricing rates (hourly, minimum, travel)
- Urgency multipliers
- Job type base prices
- Service area radius
- Working hours

### Customer Booking Flow
- 3-step booking: Issue → Details → Confirm
- Instant preset pricing (no AI needed)
- Urgency selection with surcharges
- 12-month workmanship guarantee displayed

## Tech Stack

- Expo SDK 53 / React Native
- Expo Router (file-based routing)
- Zustand (state management with persistence)
- NativeWind (Tailwind for RN)
- React Native Reanimated (animations)
- Lucide icons

## Design

- Dark theme (#0F172A background)
- Turquoise accents (#14B8A6) for CTAs
- Card-based layout
- Mobile-first, designed for on-site use

## File Structure

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx    # Tab navigator
│   │   ├── index.tsx      # Dashboard
│   │   ├── calendar.tsx   # Calendar view
│   │   ├── invoices.tsx   # Invoice management
│   │   └── settings.tsx   # Business settings
│   ├── _layout.tsx        # Root layout
│   ├── onboarding.tsx     # Trade selection on first launch
│   ├── send-link.tsx      # Send booking link modal
│   ├── job/[id].tsx       # Job details screen
│   └── book/[id].tsx      # Customer booking flow
└── lib/
    ├── store.ts           # Zustand store with all data models
    └── trades.ts          # Trade configurations (job types, pricing)
```

## Job Lifecycle

```
REQUESTED → QUOTED → APPROVED → SCHEDULED → IN_PROGRESS → COMPLETED → INVOICED → PAID
```

## Pricing Logic

- Base prices per job type (configurable in Settings)
- Urgency multipliers: Standard (1x), Urgent (1.5x), Emergency (2x)
- Travel calculated by distance × rate
- VAT added automatically
- 48-hour quote validity

## SMS/Email Integration

Send booking links directly via:
- **SMS** - Opens native Messages app with pre-filled message
- **Email** - Opens Mail app with styled HTML email template
- **Share Sheet** - Fallback for other apps (WhatsApp, etc.)

## Push Notifications

The app sends notifications for:
- New booking requests (with urgency indicators)
- Booking confirmations
- Job reminders (1 hour before scheduled jobs)
- Payment received
- Quote expiry reminders (24 hours before expiry)
- Daily reminder to send customer notifications (6 PM)

## Automation Features

### Calendar Sync
- Sync scheduled jobs to device calendar automatically
- Jobs include customer name, address, and job type
- Enable/disable in Settings → Automation
- Syncs all existing scheduled jobs when enabled

### Customer SMS Reminders
- Day-before reminder: Send via job details screen
- Morning-of reminder: Send on the day of the job
- Pre-filled messages with customer name, date, time, and address
- Duplicate prevention (won't send same reminder twice)

### Quote Expiry Follow-ups
- Warning banner on quotes expiring within 24 hours
- One-tap follow-up SMS to customer
- Pre-filled message with quote amount and call-to-action
- Scheduled notification 24 hours before expiry

Files:
- `src/lib/calendarSync.ts` - Device calendar integration
- `src/lib/customerReminders.ts` - SMS reminders service

## Payments (Stripe Connect)

TRADIE uses Stripe Connect for invoice payments:
- Each trader connects their own bank account
- Payments from customers go directly to the trader
- Stripe fees (2.9% + 20p) paid by trader, not platform

**Setup Flow:**
1. Go to Settings → Payment Setup
2. Tap "Connect Bank Account"
3. Complete Stripe's simple onboarding form
4. Done - ready to receive payments

**Files:**
- `src/lib/paymentsApi.ts` - Stripe API client (invoices + Connect)
- `backend/src/routes/payments.ts` - Invoice & payment endpoints
- `backend/src/routes/connect.ts` - Stripe Connect onboarding
- `backend/src/lib/db.ts` - SQLite database for invoices & accounts

## Subscriptions (RevenueCat)

TRADIE Pro subscription unlocks:
- Unlimited booking links (free tier: 15/month)
- Unlimited customers (free tier: 20 total)
- Custom branding on booking pages
- Business analytics
- Auto SMS reminders
- Multi-device sync

**Pricing:**
- Monthly: £7.99/month
- Yearly: £59.99/year (save 37%)
- Lifetime: £199.00 one-time

**Free Tier Limits:**
- 15 booking links per month
- 20 customers total
- Usage counter shown in the app
- Upgrade prompts when limits are reached

Files:
- `src/lib/revenuecatClient.ts` - RevenueCat SDK wrapper
- `src/lib/useProAccess.ts` - Pro access hook with limit checking
- `src/components/UpgradePrompt.tsx` - Upgrade modal component
- `src/app/paywall.tsx` - Subscription paywall screen
- `src/lib/notifications.ts` - Push notification helpers
