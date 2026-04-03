const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL;

if (!BACKEND_URL && !__DEV__) {
  throw new Error('EXPO_PUBLIC_VIBECODE_BACKEND_URL is not set. Cannot initialise payments API.');
}

const BASE_URL = BACKEND_URL ?? 'http://localhost:3000';

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
  userId?: string;
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

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Server error (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failure, use status message
    }
    throw new Error(message);
  }
  return response.json();
}

export const paymentsApi = {
  createInvoice: async (data: CreateInvoiceRequest): Promise<CreateInvoiceResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/payments/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await parseResponse<CreateInvoiceResponse>(response);
    } catch (error) {
      if (__DEV__) console.error('Error creating invoice:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  getPaymentLink: async (invoiceId: string): Promise<GetPaymentLinkResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/payments/invoices/${invoiceId}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await parseResponse<GetPaymentLinkResponse>(response);
    } catch (error) {
      if (__DEV__) console.error('Error getting payment link:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  markInvoiceSent: async (invoiceId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${BASE_URL}/api/payments/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await parseResponse<{ success: boolean; error?: string }>(response);
    } catch (error) {
      if (__DEV__) console.error('Error marking invoice sent:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  checkPaymentStatus: async (invoiceId: string): Promise<InvoiceStatusResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/payments/invoices/${invoiceId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await parseResponse<InvoiceStatusResponse>(response);
    } catch (error) {
      if (__DEV__) console.error('Error checking payment status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },
};

export const connectApi = {
  startOnboarding: async (userId: string, email?: string, businessName?: string): Promise<ConnectOnboardResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/connect/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, businessName }),
      });
      return await parseResponse<ConnectOnboardResponse>(response);
    } catch (error) {
      if (__DEV__) console.error('Error starting onboarding:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  getStatus: async (userId: string): Promise<ConnectStatusResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/connect/status/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await parseResponse<ConnectStatusResponse>(response);
    } catch (error) {
      if (__DEV__) console.warn('Error getting connect status:', error);
      return { success: false, connected: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  getDashboardLink: async (userId: string): Promise<DashboardLinkResponse> => {
    try {
      const response = await fetch(`${BASE_URL}/api/connect/dashboard-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return await parseResponse<DashboardLinkResponse>(response);
    } catch (error) {
      if (__DEV__) console.error('Error getting dashboard link:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },
};
