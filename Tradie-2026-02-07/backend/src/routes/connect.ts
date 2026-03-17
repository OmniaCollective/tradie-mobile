import { Hono } from "hono";
import { z } from "zod";
import { stripe } from "../lib/stripe";
import { stripeAccountDb } from "../lib/db";
import { env } from "../env";

const connect = new Hono();

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Create a Stripe Connect account and return onboarding link
connect.post("/onboard", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, email, businessName } = z.object({
      userId: z.string(),
      email: z.string().email().optional(),
      businessName: z.string().optional(),
    }).parse(body);

    // Check if user already has a Stripe account
    let existingAccount = stripeAccountDb.getByUserId(userId);

    if (existingAccount) {
      // Check if onboarding is complete
      const account = await stripe.accounts.retrieve(existingAccount.stripe_account_id);

      if (account.charges_enabled && account.payouts_enabled) {
        return c.json({
          success: true,
          status: "complete",
          message: "Payment setup already complete",
        });
      }

      // Create new onboarding link for incomplete account
      const accountLink = await stripe.accountLinks.create({
        account: existingAccount.stripe_account_id,
        refresh_url: `${env.BACKEND_URL}/api/connect/refresh?user_id=${userId}`,
        return_url: `${env.BACKEND_URL}/api/connect/return?user_id=${userId}`,
        type: "account_onboarding",
      });

      return c.json({
        success: true,
        status: "pending",
        onboardingUrl: accountLink.url,
      });
    }

    // Create a new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: email,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: businessName,
        product_description: "Trade services",
      },
    });

    // Save to database
    stripeAccountDb.create({
      id: generateId(),
      user_id: userId,
      stripe_account_id: account.id,
      charges_enabled: 0,
      payouts_enabled: 0,
      details_submitted: 0,
      business_name: businessName,
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${env.BACKEND_URL}/api/connect/refresh?user_id=${userId}`,
      return_url: `${env.BACKEND_URL}/api/connect/return?user_id=${userId}`,
      type: "account_onboarding",
    });

    return c.json({
      success: true,
      status: "pending",
      onboardingUrl: accountLink.url,
      stripeAccountId: account.id,
    });
  } catch (error) {
    console.error("Error creating Connect account:", error);
    return c.json({ success: false, error: "Failed to create payment account" }, 500);
  }
});

// Get account status
connect.get("/status/:userId", async (c) => {
  const userId = c.req.param("userId");

  try {
    const dbAccount = stripeAccountDb.getByUserId(userId);

    if (!dbAccount) {
      return c.json({
        success: true,
        connected: false,
        status: "not_connected",
      });
    }

    // Get fresh status from Stripe
    const account = await stripe.accounts.retrieve(dbAccount.stripe_account_id);

    // Update database with latest status
    stripeAccountDb.update(userId, {
      charges_enabled: account.charges_enabled ? 1 : 0,
      payouts_enabled: account.payouts_enabled ? 1 : 0,
      details_submitted: account.details_submitted ? 1 : 0,
    });

    return c.json({
      success: true,
      connected: true,
      status: account.charges_enabled && account.payouts_enabled ? "complete" : "pending",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      stripeAccountId: dbAccount.stripe_account_id,
    });
  } catch (error) {
    console.error("Error getting account status:", error);
    return c.json({ success: false, error: "Failed to get account status" }, 500);
  }
});

// Return URL after onboarding
connect.get("/return", async (c) => {
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.html(renderResultPage("error", "Missing user ID"));
  }

  try {
    const dbAccount = stripeAccountDb.getByUserId(userId);

    if (!dbAccount) {
      return c.html(renderResultPage("error", "Account not found"));
    }

    // Check account status
    const account = await stripe.accounts.retrieve(dbAccount.stripe_account_id);

    // Update database
    stripeAccountDb.update(userId, {
      charges_enabled: account.charges_enabled ? 1 : 0,
      payouts_enabled: account.payouts_enabled ? 1 : 0,
      details_submitted: account.details_submitted ? 1 : 0,
    });

    if (account.charges_enabled && account.payouts_enabled) {
      return c.html(renderResultPage("success", "Payment setup complete! You can now receive payments."));
    } else if (account.details_submitted) {
      return c.html(renderResultPage("pending", "Your account is being reviewed. This usually takes 1-2 business days."));
    } else {
      return c.html(renderResultPage("incomplete", "Setup incomplete. Please complete all required information."));
    }
  } catch (error) {
    console.error("Error in return URL:", error);
    return c.html(renderResultPage("error", "Something went wrong. Please try again."));
  }
});

// Refresh URL if onboarding link expires
connect.get("/refresh", async (c) => {
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.html(renderResultPage("error", "Missing user ID"));
  }

  try {
    const dbAccount = stripeAccountDb.getByUserId(userId);

    if (!dbAccount) {
      return c.html(renderResultPage("error", "Account not found"));
    }

    // Create new onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: dbAccount.stripe_account_id,
      refresh_url: `${env.BACKEND_URL}/api/connect/refresh?user_id=${userId}`,
      return_url: `${env.BACKEND_URL}/api/connect/return?user_id=${userId}`,
      type: "account_onboarding",
    });

    // Redirect to new link
    return c.redirect(accountLink.url);
  } catch (error) {
    console.error("Error refreshing onboarding link:", error);
    return c.html(renderResultPage("error", "Failed to refresh. Please try again from the app."));
  }
});

// Create Stripe dashboard login link
connect.post("/dashboard-link", async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = z.object({
      userId: z.string(),
    }).parse(body);

    const dbAccount = stripeAccountDb.getByUserId(userId);

    if (!dbAccount) {
      return c.json({ success: false, error: "No payment account found" }, 404);
    }

    const loginLink = await stripe.accounts.createLoginLink(dbAccount.stripe_account_id);

    return c.json({
      success: true,
      dashboardUrl: loginLink.url,
    });
  } catch (error) {
    console.error("Error creating dashboard link:", error);
    return c.json({ success: false, error: "Failed to create dashboard link" }, 500);
  }
});

// Helper function to render result pages
function renderResultPage(status: "success" | "pending" | "incomplete" | "error", message: string) {
  const colors = {
    success: { bg: "#10b981", gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)" },
    pending: { bg: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
    incomplete: { bg: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
    error: { bg: "#ef4444", gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" },
  };

  const icons = {
    success: '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>',
    pending: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>',
    incomplete: '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round"/>',
    error: '<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  const titles = {
    success: "Success!",
    pending: "Under Review",
    incomplete: "Almost There",
    error: "Error",
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${titles[status]}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: ${colors[status].gradient};
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
          background: ${colors[status].bg};
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
          stroke-width: 2;
          fill: none;
        }
        h1 {
          color: #1f2937;
          margin: 0 0 12px;
          font-size: 24px;
        }
        p {
          color: #6b7280;
          margin: 0 0 24px;
          font-size: 16px;
          line-height: 1.5;
        }
        .button {
          display: inline-block;
          background: ${colors[status].bg};
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg viewBox="0 0 24 24">
            ${icons[status]}
          </svg>
        </div>
        <h1>${titles[status]}</h1>
        <p>${message}</p>
        <p style="color: #9ca3af; font-size: 14px;">You can close this page and return to the app.</p>
      </div>
    </body>
    </html>
  `;
}

export default connect;
