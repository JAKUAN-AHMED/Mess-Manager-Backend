# Mess Management System — Backend

## Setup

```bash
npm install
npm run dev      # development (node --watch)
npm start        # production
```

## First-time Setup

Create the first admin account (only works once, when no admin exists):

```bash
curl -X POST http://localhost:5000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"name":"আপনার নাম","phone":"01XXXXXXXXX","password":"yourpassword"}'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/setup-admin | Create first admin |
| GET | /api/users | List all members |
| POST | /api/users | Add member (admin) |
| PUT | /api/users/:id | Update member (admin) |
| GET | /api/meals | Get meals by month |
| POST | /api/meals | Add/update meal entry |
| GET | /api/expenses | Get expenses by month |
| POST | /api/expenses | Add expense |
| DELETE | /api/expenses/:id | Delete expense (admin) |
| GET | /api/reports/monthly-summary | Monthly totals |
| GET | /api/reports/all-bills | All member bills |
| GET | /api/reports/yearly-trend | Chart data |
| POST | /api/payments | Record payment |

Server runs on **port 5000** by default.
