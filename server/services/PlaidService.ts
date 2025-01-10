import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';
import { AppError } from '../domain/errors/AppError';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

class PlaidService {
  private client: PlaidApi;

  constructor() {
    this.client = new PlaidApi(configuration);
  }

  async createLinkToken(userId: number) {
    try {
      const request = {
        user: { client_user_id: userId.toString() },
        client_name: 'Finance Manager',
        products: ['transactions', 'income'] as Products[],
        country_codes: ['US'] as CountryCode[],
        language: 'en',
      };

      const response = await this.client.linkTokenCreate(request);
      return response.data;
    } catch (error: any) {
      console.error('Error creating link token:', error);
      if (error.response?.data?.error_message) {
        throw AppError.internal(`Failed to create bank link: ${error.response.data.error_message}`);
      }
      throw AppError.internal('Failed to create bank link');
    }
  }

  async exchangePublicToken(publicToken: string) {
    try {
      const response = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error exchanging public token:', error);
      if (error.response?.data?.error_message) {
        throw AppError.internal(`Failed to link bank account: ${error.response.data.error_message}`);
      }
      throw AppError.internal('Failed to link bank account');
    }
  }

  async getIncome(accessToken: string) {
    try {
      // First get the user's accounts
      const accountsResponse = await this.client.accountsGet({
        access_token: accessToken,
      });

      // Then get the income data using transactions
      const now = new Date();
      const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));

      const transactionsResponse = await this.client.transactionsGet({
        access_token: accessToken,
        start_date: sixMonthsAgo.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        options: {
          include_personal_finance_category: true,
        }
      });

      // Calculate monthly income from transactions
      const incomeTransactions = transactionsResponse.data.transactions.filter(
        transaction => transaction.amount < 0 // Credits are negative in Plaid
      );

      const monthlyIncome = incomeTransactions.reduce((sum, transaction) => 
        sum + Math.abs(transaction.amount), 0) / 6; // Average over 6 months

      return {
        income_streams: [{
          monthly_income: monthlyIncome,
          name: "Estimated Monthly Income",
          next_payment_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        }],
      };
    } catch (error: any) {
      console.error('Error fetching income:', error);
      if (error.response?.data?.error_message) {
        throw AppError.internal(`Failed to fetch income information: ${error.response.data.error_message}`);
      }
      throw AppError.internal('Failed to fetch income information');
    }
  }

  async getTransactions(accessToken: string, startDate: string, endDate: string) {
    try {
      const response = await this.client.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          include_personal_finance_category: true,
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      if (error.response?.data?.error_message) {
        throw AppError.internal(`Failed to fetch transactions: ${error.response.data.error_message}`);
      }
      throw AppError.internal('Failed to fetch transactions');
    }
  }
}

export const plaidService = new PlaidService();