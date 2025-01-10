import {  } from '@tink/api';
import { AppError } from '../domain/errors/AppError';

class TinkService {
  private client: TinkApi;
  private accessToken: string | null = null;

  constructor() {
    this.client = new TinkApi({
      basePath: process.env.TINK_API_URL || 'https://api.tink.com',
      baseOptions: {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      const params = new URLSearchParams({
        client_id: process.env.TINK_CLIENT_ID!,
        client_secret: process.env.TINK_CLIENT_SECRET!,
        grant_type: 'client_credentials',
        scope: 'authorization:read,authorization:grant'
      });

      const response = await fetch('https://api.tink.com/api/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      return this.accessToken;
    } catch (error: any) {
      console.error('Error getting Tink access token:', error);
      throw AppError.internal('Failed to authenticate with Tink');
    }
  }

  async createAuthorizationLink(userId: number) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch('https://api.tink.com/api/v1/authorization-grant/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          actor_client_id: process.env.TINK_ACTOR_CLIENT_ID,
          market: 'NO',
          locale: 'no_NO',
          scope: [
            'accounts:read',
            'transactions:read',
            'investments:read',
            'user:read'
          ].join(' '),
          redirect_uri: process.env.TINK_REDIRECT_URI
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create authorization link: ${error}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error creating Tink authorization link:', error);
      if (error.response?.data?.error_message) {
        throw AppError.internal(`Failed to create bank link: ${error.response.data.error_message}`);
      }
      throw AppError.internal('Failed to create bank link');
    }
  }

  async getAccounts(userAccessToken: string) {
    try {
      const response = await fetch('https://api.tink.com/data/v2/accounts', {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch accounts: ${error}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      throw AppError.internal('Failed to fetch accounts');
    }
  }

  async getTransactions(userAccessToken: string, pageSize: number = 100, pageToken?: string) {
    try {
      const url = new URL('https://api.tink.com/data/v2/transactions');
      url.searchParams.append('pageSize', pageSize.toString());
      if (pageToken) {
        url.searchParams.append('pageToken', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch transactions: ${error}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      throw AppError.internal('Failed to fetch transactions');
    }
  }
}

export const tinkService = new TinkService();