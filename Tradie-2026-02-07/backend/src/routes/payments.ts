import { Hono } from "hono";
import { z } from "zod";
import { stripe } from "../lib/stripe";
import { invoiceDb, stripeAccountDb } from "../lib/db";
import type { DbInvoice } from "../lib/db";
import { env } from "../env";

const payments = new Hono();

// Schema for creating an invoice
const createInvoiceSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  businessName: z.string(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().optional(),
  labour: z.number(),
  materials: z.number(),
  travel: z.number(),
  emergencySurcharge: z.number().default(0),
  vat: z.number(),
  total: z.number(),
  userId: z.string().optional(), // For Stripe Connect - identifies the trader
});

// Create invoice and get payment link
payments.post("/invoices", async (c) => {
  try {
    const body = await c.req.json();
    const data = createInvoiceSchema.parse(body);

    // Check if invoice already exists
    const existing = invoiceDb.getById(data.id);
    if (existing) {
      return c.json({
        success: true,
        invoice: existing,
        paymentLink: existing.stripe_payment_link,
      });
    }

    // Check if user has a connected Stripe account
    let stripeAccountId: string | undefined;
    if (data.userId) {
      const connectedAccount = stripeAccountDb.getByUserId(data.userId);
      if (connectedAccount && connectedAccount.charges_enabled) {
        stripeAccountId = connectedAccount.stripe_account_id;
      }
    }

    // Build checkout session config
    const lineItems = [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Invoice from ${data.businessName}`,
            description: `Labour: £${data.labour.toFixed(2)}, Materials: £${data.materials.toFixed(2)}, Travel: £${data.travel.toFixed(2)}${data.emergencySurcharge > 0 ? `, Emergency: £${data.emergencySurcharge.toFixed(2)}` : ""}, VAT: £${data.vat.toFixed(2)}`,
          },
          unit_amount: Math.round(data.total * 100),
        },
        quantity: 1,
      },
    ];

    let session;

    // If using Stripe Connect, payment goes directly to trader
    if (stripeAccountId) {
      session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: "payment",
        success_url: `${env.BACKEND_URL}/api/payments/success?invoice_id=${data.id}`,
        cancel_url: `${env.BACKEND_URL}/api/payments/cancel?invoice_id=${data.id}`,
        customer_email: data.customerEmail,
        metadata: {
          invoice_id: data.id,
          job_id: data.jobId,
        },
        payment_intent_data: {
          transfer_data: {
            destination: stripeAccountId,
          },
          metadata: {
            invoice_id: data.id,
            job_id: data.jobId,
          },
        },
      });
    } else {
      session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: "payment",
        success_url: `${env.BACKEND_URL}/api/payments/success?invoice_id=${data.id}`,
        cancel_url: `${env.BACKEND_URL}/api/payments/cancel?invoice_id=${data.id}`,
        customer_email: data.customerEmail,
        metadata: {
          invoice_id: data.id,
          job_id: data.jobId,
        },
      });
    }

    // Save invoice to database
    const invoice: Omit<DbInvoice, "created_at"> = {
      id: data.id,
      job_id: data.jobId,
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      customer_address: data.customerAddress,
      business_name: data.businessName,
      business_email: data.businessEmail,
      business_phone: data.businessPhone,
      labour: data.labour,
      materials: data.materials,
      travel: data.travel,
      emergency_surcharge: data.emergencySurcharge,
      vat: data.vat,
      total: data.total,
      status: "pending",
      stripe_payment_intent_id: session.payment_intent as string || undefined,
      stripe_payment_link: session.url || undefined,
      stripe_account_id: stripeAccountId,
    };

    invoiceDb.create(invoice);

    return c.json({
      success: true,
      invoice,
      paymentLink: session.url,
      paymentIntentId: session.payment_intent,
      connectedAccount: !!stripeAccountId,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: "Invalid invoice data", details: error.issues }, 400);
    }
    return c.json({ success: false, error: "Failed to create invoice" }, 500);
  }
});

// Get invoice by ID
payments.get("/invoices/:id", async (c) => {
  const id = c.req.param("id");
  const invoice = invoiceDb.getById(id);

  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }

  return c.json({ success: true, invoice });
});

// Get payment link for existing invoice
payments.post("/invoices/:id/payment-link", async (c) => {
  const id = c.req.param("id");
  const invoice = invoiceDb.getById(id);

  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }

  // If we already have a valid payment link, return it
  if (invoice.stripe_payment_link) {
    return c.json({
      success: true,
      paymentLink: invoice.stripe_payment_link,
    });
  }

  // Create new checkout session
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Invoice from ${invoice.business_name}`,
            description: `Labour: £${invoice.labour.toFixed(2)}, Materials: £${invoice.materials.toFixed(2)}, Travel: £${invoice.travel.toFixed(2)}${invoice.emergency_surcharge > 0 ? `, Emergency: £${invoice.emergency_surcharge.toFixed(2)}` : ""}, VAT: £${invoice.vat.toFixed(2)}`,
          },
          unit_amount: Math.round(invoice.total * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.BACKEND_URL}/api/payments/success?invoice_id=${id}`,
    cancel_url: `${env.BACKEND_URL}/api/payments/cancel?invoice_id=${id}`,
    customer_email: invoice.customer_email,
    metadata: {
      invoice_id: id,
    },
  });

  // Update invoice with new payment link
  if (session.url) {
    invoiceDb.updateStripeInfo(id, invoice.stripe_payment_intent_id || "", session.url);
  }

  return c.json({
    success: true,
    paymentLink: session.url,
  });
});

// Payment success page
payments.get("/success", async (c) => {
  const invoiceId = c.req.query("invoice_id");

  if (invoiceId) {
    invoiceDb.updateStatus(invoiceId, "paid", new Date().toISOString());
  }

  // Return a simple HTML success page
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 400px;
          margin: 20px;
        }
        .checkmark {
          width: 80px;
          height: 80px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 24px;
        }
        .checkmark svg {
          width: 40px;
          height: 40px;
          stroke: white;
          stroke-width: 3;
        }
        h1 {
          color: #1f2937;
          margin: 0 0 12px;
          font-size: 24px;
        }
        p {
          color: #6b7280;
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>Payment Successful!</h1>
        <p>Thank you for your payment. You will receive a confirmation email shortly.</p>
      </div>
    </body>
    </html>
  `);
});

// Payment cancel page
payments.get("/cancel", async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        .container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 400px;
          margin: 20px;
        }
        .icon {
          width: 80px;
          height: 80px;
          background: #f59e0b;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 24px;
        }
        .icon svg {
          width: 40px;
          height: 40px;
          stroke: white;
          stroke-width: 3;
        }
        h1 {
          color: #1f2937;
          margin: 0 0 12px;
          font-size: 24px;
        }
        p {
          color: #6b7280;
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. If you'd like to try again, please use the payment link sent to you.</p>
      </div>
    </body>
    </html>
  `);
});

// Stripe webhook handler
payments.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  const rawBody = await c.req.text();

  try {
    let event;

    // Verify webhook signature if secret is configured
    if (env.STRIPE_WEBHOOK_SECRET && sig) {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } else {
      // Fallback for development (no signature verification)
      event = JSON.parse(rawBody);
      console.log("Warning: Webhook signature not verified (STRIPE_WEBHOOK_SECRET not set)");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;

      if (invoiceId) {
        invoiceDb.updateStatus(invoiceId, "paid", new Date().toISOString());
        console.log(`Invoice ${invoiceId} marked as paid via webhook`);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata?.invoice_id;

      if (invoiceId) {
        invoiceDb.updateStatus(invoiceId, "paid", new Date().toISOString());
        console.log(`Invoice ${invoiceId} marked as paid via payment_intent webhook`);
      }
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return c.json({ error: "Webhook handler failed" }, 400);
  }
});

// Mark invoice as sent
payments.post("/invoices/:id/send", async (c) => {
  const id = c.req.param("id");
  const invoice = invoiceDb.getById(id);

  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }

  invoiceDb.markSent(id);

  return c.json({
    success: true,
    message: "Invoice marked as sent",
  });
});

// Check payment status
payments.get("/invoices/:id/status", async (c) => {
  const id = c.req.param("id");
  const invoice = invoiceDb.getById(id);

  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }

  // If we have a payment intent, check its status
  if (invoice.stripe_payment_intent_id) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);

      if (paymentIntent.status === "succeeded" && invoice.status !== "paid") {
        invoiceDb.updateStatus(id, "paid", new Date().toISOString());
        return c.json({
          success: true,
          status: "paid",
          paidAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Error checking payment intent:", err);
    }
  }

  return c.json({
    success: true,
    status: invoice.status,
    paidAt: invoice.paid_at,
  });
});

export default payments;
