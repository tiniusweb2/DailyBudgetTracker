
# Daily Budget App

A full-stack web application for managing daily budgets, transactions, and financial planning.

## Features

- User authentication
- Daily budget tracking and visualization
- Transaction management with automatic category prediction
- Bank account integration via Plaid
- Planned expenses management
- Income source tracking
- Interactive charts and analytics

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Testing**: Vitest, React Testing Library
- **Authentication**: Passport.js
- **Financial Integration**: Plaid API

## Getting Started

1. Clone the project in Replit
2. Install dependencies:
```bash
npm install
```
3. Set up your environment variables in Replit's Secrets tab
4. Start the development server:
```bash
npm run dev
```

The application will be available on port 5000.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run check` - Type checking
- `npm test` - Run tests
- `npm run db:push` - Update database schema

## Project Structure

- `/client` - React frontend application
- `/server` - Express.js backend
- `/db` - Database schema and configuration
- `/components` - Reusable UI components
- `/hooks` - Custom React hooks
- `/services` - Business logic and external services

## Testing

The project includes unit tests for both frontend and backend. Run tests using:
```bash
npm test
```

## Database

Uses PostgreSQL with Drizzle ORM for:
- User management
- Transaction tracking
- Budget calculations
- Planned expenses
- Income sources

## License

MIT
