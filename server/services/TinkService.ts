import { AppError } from '../domain/errors/AppError';

class TinkService {
  private CLIENT_ID: string;
  private CLIENT_SECRET: string;
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;
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
    // Return existing token if it's still valid (with 5 minutes buffer)
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration.getTime() - Date.now() > 300000) {
      return this.accessToken;
    }

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get access token:', errorText);
        throw new Error(`Failed to get access token: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
      }

      const data = await response.json();

      if (!data.access_token || !data.expires_in) {
        throw new Error('Invalid token response format');
      }

      this.accessToken = data.access_token;
      this.tokenExpiration = new Date(Date.now() + (data.expires_in * 1000));
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Authorization link error:', errorText);
        throw new Error(`Failed to create authorization link: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
      }

      const data = await response.json();

      if (!data.code) {
        throw new Error('Invalid authorization response format');
      }

      return {
        code: data.code,
        id: data.id
      };
    } catch (error: any) {
      console.error('Error creating Tink authorization link:', error);
      throw AppError.internal('Failed to create bank link');
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange error:', errorText);
        throw new Error(`Failed to exchange authorization code: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Invalid token exchange response format');
      }

      return data.access_token;
    } catch (error: any) {
      console.error('Error exchanging authorization code:', error);
      throw AppError.internal('Failed to complete bank linking');
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transaction fetch error:', errorText);
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      throw AppError.internal('Failed to fetch transactions');
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

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      throw AppError.internal('Failed to fetch accounts');
    }
  }
}

export const tinkService = new TinkService();