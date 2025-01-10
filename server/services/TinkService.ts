import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';
import { AppError } from '../domain/errors/AppError';

class TinkService {
  private CLIENT_ID: string;
  private CLIENT_SECRET: string;
  private ACTOR_CLIENT_ID: string;

  constructor() {
    this.CLIENT_ID = process.env.TINK_CLIENT_ID || '';
    this.CLIENT_SECRET = process.env.TINK_CLIENT_SECRET || '';
    this.ACTOR_CLIENT_ID = this.CLIENT_ID;

    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      throw new Error('Tink credentials not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      const params = new URLSearchParams({
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'authorization:read,authorization:grant'
      });

      const response = await fetch('https://api.tink.com/api/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token request failed:', errorText);
        throw AppError.internal('Failed to authenticate with Tink', 'failed_auth');
      }

      const data = await response.json();

      if (!data.access_token || !data.expires_in) {
        throw new Error('Invalid token response format');
      }

      return data.access_token;
    } catch (error) {
      console.error('Error getting Tink access token:', error);
      if (error instanceof AppError || error instanceof Error) {
        throw error;
      }
      throw AppError.internal('Failed to authenticate with Tink', 'failed_auth');
    }
  }

  async createAuthorizationLink(userId: number) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch('https://api.tink.com/api/v1/authorization-grant/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          actor_client_id: this.ACTOR_CLIENT_ID,
          market: 'US',
          locale: 'en_US',
          scope: [
            'accounts:read',
            'transactions:read',
            'investments:read',
            'user:read'
          ].join(' '),
          redirect_uri: `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/tink/callback`
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Authorization link error:', errorText);
        throw AppError.internal('Failed to create bank link', 'failed_create_link');
      }

      const data = await response.json();

      if (!data.code || !data.id) {
        throw new Error('Invalid authorization response format');
      }

      return {
        code: data.code,
        id: data.id
      };
    } catch (error) {
      console.error('Error creating Tink authorization link:', error);
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.message.includes('Invalid authorization response format')) {
          throw error;
        }
        if (error.message.startsWith('Expected JSON response')) {
          throw error;
        }
      }
      throw AppError.internal('Failed to create bank link', 'failed_create_link');
    }
  }

  async exchangeAuthorizationCode(code: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        code,
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        grant_type: 'authorization_code'
      });

      const response = await fetch('https://api.tink.com/api/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange error:', errorText);
        throw AppError.internal('Failed to complete bank linking', 'failed_exchange_token');
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Invalid token exchange format');
      }

      return data.access_token;
    } catch (error) {
      console.error('Error exchanging authorization code:', error);
      if (error instanceof AppError || error instanceof Error) {
        throw error;
      }
      throw AppError.internal('Failed to complete bank linking', 'failed_exchange_token');
    }
  }

  async getTransactions(userAccessToken: string, pageSize: number = 100) {
    try {
      const response = await fetch(`https://api.tink.com/data/v2/transactions?pageSize=${pageSize}`, {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Accept': 'application/json'
        }
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transaction fetch error:', errorText);
        throw AppError.internal('Failed to fetch transactions', 'failed_fetch_transactions');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching transactions:', error);
      if (error instanceof AppError || error instanceof Error) {
        throw error;
      }
      throw AppError.internal('Failed to fetch transactions', 'failed_fetch_transactions');
    }
  }

  async getAccounts(userAccessToken: string) {
    try {
      const response = await fetch('https://api.tink.com/data/v2/accounts', {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Accept': 'application/json'
        }
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Account fetch error:', errorText);
        throw AppError.internal('Failed to fetch accounts', 'failed_fetch_accounts');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching accounts:', error);
      if (error instanceof AppError || error instanceof Error) {
        throw error;
      }
      throw AppError.internal('Failed to fetch accounts', 'failed_fetch_accounts');
    }
  }
}

export const tinkService = new TinkService();