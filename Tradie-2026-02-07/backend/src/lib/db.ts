import { Database } from "bun:sqlite";

// Initialize SQLite database
const db = new Database("tradie.db", { create: true });

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    business_name TEXT NOT NULL,
    business_email TEXT,
    business_phone TEXT,
    labour REAL NOT NULL,
    materials REAL NOT NULL,
    travel REAL NOT NULL,
    emergency_surcharge REAL DEFAULT 0,
    vat REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    stripe_payment_intent_id TEXT,
    stripe_payment_link TEXT,
    stripe_account_id TEXT,
    sent_at TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Stripe Connect accounts table
db.run(`
  CREATE TABLE IF NOT EXISTS stripe_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    stripe_account_id TEXT NOT NULL,
    charges_enabled INTEGER DEFAULT 0,
    payouts_enabled INTEGER DEFAULT 0,
    details_submitted INTEGER DEFAULT 0,
    business_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface DbInvoice {
  id: string;
  job_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  business_name: string;
  business_email?: string;
  business_phone?: string;
  labour: number;
  materials: number;
  travel: number;
  emergency_surcharge: number;
  vat: number;
  total: number;
  status: "pending" | "sent" | "paid";
  stripe_payment_intent_id?: string;
  stripe_payment_link?: string;
  stripe_account_id?: string;
  sent_at?: string;
  paid_at?: string;
  created_at: string;
}

export interface DbStripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  charges_enabled: number;
  payouts_enabled: number;
  details_submitted: number;
  business_name?: string;
  created_at: string;
  updated_at: string;
}

// Invoice operations
export const invoiceDb = {
  create: (invoice: Omit<DbInvoice, "created_at">) => {
    const stmt = db.prepare(`
      INSERT INTO invoices (
        id, job_id, customer_id, customer_name, customer_email, customer_phone, customer_address,
        business_name, business_email, business_phone,
        labour, materials, travel, emergency_surcharge, vat, total,
        status, stripe_payment_intent_id, stripe_payment_link, sent_at, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      invoice.id,
      invoice.job_id,
      invoice.customer_id,
      invoice.customer_name,
      invoice.customer_email,
      invoice.customer_phone || null,
      invoice.customer_address || null,
      invoice.business_name,
      invoice.business_email || null,
      invoice.business_phone || null,
      invoice.labour,
      invoice.materials,
      invoice.travel,
      invoice.emergency_surcharge,
      invoice.vat,
      invoice.total,
      invoice.status,
      invoice.stripe_payment_intent_id || null,
      invoice.stripe_payment_link || null,
      invoice.sent_at || null,
      invoice.paid_at || null
    );

    return invoice;
  },

  getById: (id: string): DbInvoice | null => {
    const stmt = db.prepare("SELECT * FROM invoices WHERE id = ?");
    return stmt.get(id) as DbInvoice | null;
  },

  updateStatus: (id: string, status: string, paidAt?: string) => {
    const stmt = db.prepare("UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?");
    stmt.run(status, paidAt || null, id);
  },

  updateStripeInfo: (id: string, paymentIntentId: string, paymentLink?: string) => {
    const stmt = db.prepare("UPDATE invoices SET stripe_payment_intent_id = ?, stripe_payment_link = ? WHERE id = ?");
    stmt.run(paymentIntentId, paymentLink || null, id);
  },

  markSent: (id: string) => {
    const stmt = db.prepare("UPDATE invoices SET status = 'sent', sent_at = ? WHERE id = ?");
    stmt.run(new Date().toISOString(), id);
  },

  getByPaymentIntentId: (paymentIntentId: string): DbInvoice | null => {
    const stmt = db.prepare("SELECT * FROM invoices WHERE stripe_payment_intent_id = ?");
    return stmt.get(paymentIntentId) as DbInvoice | null;
  },
};

// Stripe Connect account operations
export const stripeAccountDb = {
  create: (account: Omit<DbStripeAccount, "created_at" | "updated_at">) => {
    const stmt = db.prepare(`
      INSERT INTO stripe_accounts (id, user_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, business_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      account.id,
      account.user_id,
      account.stripe_account_id,
      account.charges_enabled,
      account.payouts_enabled,
      account.details_submitted,
      account.business_name || null
    );
    return account;
  },

  getByUserId: (userId: string): DbStripeAccount | null => {
    const stmt = db.prepare("SELECT * FROM stripe_accounts WHERE user_id = ?");
    return stmt.get(userId) as DbStripeAccount | null;
  },

  getByStripeAccountId: (stripeAccountId: string): DbStripeAccount | null => {
    const stmt = db.prepare("SELECT * FROM stripe_accounts WHERE stripe_account_id = ?");
    return stmt.get(stripeAccountId) as DbStripeAccount | null;
  },

  update: (userId: string, updates: Partial<DbStripeAccount>) => {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.charges_enabled !== undefined) {
      fields.push("charges_enabled = ?");
      values.push(updates.charges_enabled);
    }
    if (updates.payouts_enabled !== undefined) {
      fields.push("payouts_enabled = ?");
      values.push(updates.payouts_enabled);
    }
    if (updates.details_submitted !== undefined) {
      fields.push("details_submitted = ?");
      values.push(updates.details_submitted);
    }
    if (updates.business_name !== undefined) {
      fields.push("business_name = ?");
      values.push(updates.business_name || null);
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(userId);

    const stmt = db.prepare(`UPDATE stripe_accounts SET ${fields.join(", ")} WHERE user_id = ?`);
    stmt.run(...values);
  },

  delete: (userId: string) => {
    const stmt = db.prepare("DELETE FROM stripe_accounts WHERE user_id = ?");
    stmt.run(userId);
  },
};

export { db };
