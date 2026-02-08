const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

interface CreateInvoiceRequest {
  id: string;
  jobId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  labour: number;
  materials: number;
  travel: number;
  emergencySurcharge: number;
  vat: number;
  total: number;
  userId?: string; // For Stripe Connect
}

interface CreateInvoiceResponse {
  success: boolean;
  invoice?: {
    id: string;
    stripe_payment_link?: string;
  };
  paymentLink?: string;
  paymentIntentId?: string;
  connectedAccount?: boolean;
  error?: string;
}

interface GetPaymentLinkResponse {
  success: boolean;
  paymentLink?: string;
  error?: string;
}

interface InvoiceStatusResponse {
  success: boolean;
  status?: 'pending' | 'sent' | 'paid';
  paidAt?: string;
  error?: string;
}

interface ConnectOnboardResponse {
  success: boolean;
  status?: 'complete' | 'pending';
  onboardingUrl?: string;
  stripeAccountId?: string;
  message?: string;
  error?: string;
}

interface ConnectStatusResponse {
  success: boolean;
  connected: boolean;
  status?: 'complete' | 'pending' | 'not_connected';
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  stripeAccountId?: string;
  error?: string;
}

interface DashboardLinkResponse {
  success: boolean;
  dashboardUrl?: string;
  error?: string;
}

export const paymentsApi = {
  /**
   * Create an invoice in the backend and get a Stripe payment link
   */
  createInvoice: async (data: CreateInvoiceRequest): Promise<CreateInvoiceResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating invoice:', error);
      return { success: false, error: 'Network error' };
    }
  },

  /**
   * Get a new payment link for an existing invoice
   */
  getPaymentLink: async (invoiceId: string): Promise<GetPaymentLinkResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/invoices/${invoiceId}/payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting payment link:', error);
      return { success: false, error: 'Network error' };
    }
  },

  /**
   * Mark an invoice as sent
   */
  markInvoiceSent: async (invoiceId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error marking invoice sent:', error);
      return { success: false, error: 'Network error' };
    }
  },

  /**
   * Check payment status for an invoice
   */
  checkPaymentStatus: async (invoiceId: string): Promise<InvoiceStatusResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/invoices/${invoiceId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error checking payment status:', error);
      return { success: false, error: 'Network error' };
    }
  },
};

export const connectApi = {
  /**
   * Start Stripe Connect onboarding - returns URL to Stripe's onboarding form
   */
  startOnboarding: async (userId: string, email?: string, businessName?: string): Promise<ConnectOnboardResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/connect/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, email, businessName }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error starting onboarding:', error);
      return { success: false, error: 'Network error' };
    }
  },

  /**
   * Check Stripe Connect account status
   */
  getStatus: async (userId: string): Promise<ConnectStatusResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/connect/status/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting connect status:', error);
      return { success: false, connected: false, error: 'Network error' };
    }
  },

  /**
   * Get Stripe Dashboard login link
   */
  getDashboardLink: async (userId: string): Promise<DashboardLinkResponse> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/connect/dashboard-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting dashboard link:', error);
      return { success: false, error: 'Network error' };
    }
  },
};
