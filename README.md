# Stockwise Inventory Management System

A responsive web-based inventory management project built with **HTML5, CSS3, JavaScript, Node.js, Express, and MySQL**. Includes user registration/login, password hashing, session-based authentication, dashboard statistics, product CRUD, search, filters, sorting, low-stock insights, and CSV export.

## Requirements

- Node.js 18 or newer
- MySQL 8 (or compatible MySQL server)
- npm
- VS Code, IntelliJ IDEA, or another editor

## Setup

### 1. Create the database

Start MySQL, then open MySQL Workbench or a terminal and run the complete `database.sql` file. This creates the `stockwise_inventory` database, the `users` and `products` tables, and six optional sample products.

Example from a terminal:

```bash
mysql -u root -p < database.sql
```

### 2. Configure environment variables

Copy `.env.example` to `.env`, then set your own MySQL credentials and a long random session secret.

Windows Command Prompt:

```bat
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set `DB_PASSWORD` to your local MySQL password. Do not share or commit `.env`.

### 3. Install dependencies

From the project folder:

```bash
npm install
```

### 4. Start the application

```bash
npm start
```

Open **http://localhost:3000** in your browser. Keep the terminal running while using the app.

## How to use

1. Register an account with a valid email and a password of at least 8 characters.
2. Sign in.
3. Add products with a unique SKU, category, price, quantity, and reorder level.
4. Use Edit or Delete to update/remove a record.
5. Search by product name, SKU, or category; filter by category or stock status; sort by name, quantity, or inventory value.
6. Export the product list to CSV.
7. Log out when finished.

## API routes

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Start session | No |
| POST | `/api/auth/logout` | End session | Session |
| GET | `/api/auth/me` | Current user | No |
| GET | `/api/products` | List/search/filter/sort products | Yes |
| POST | `/api/products` | Create product | Yes |
| PUT | `/api/products/:id` | Update product | Yes |
| DELETE | `/api/products/:id` | Delete product | Yes |
| GET | `/api/dashboard` | Dashboard totals and category totals | Yes |
| GET | `/api/health` | Database connection health check | No |

### Query parameters for products

- `q`: search in product name, SKU, or category
- `category`: exact category
- `status`: `in`, `low`, or `out`
- `sort`: `name`, `quantityAsc`, `quantityDesc`, or `valueDesc`

Example: `/api/products?q=mouse&status=in&sort=name`

## Database design

- `users`: stores account name, unique email, bcrypt password hash, and creation time.
- `products`: stores product name, unique SKU, category, price, quantity, reorder level, optional creator, and timestamps.

## Notes / production hardening

- Passwords are hashed with bcrypt; the app never stores plain-text passwords in the database.
- Database queries use placeholders for user-supplied values.
- Session cookies are HTTP-only and SameSite=Lax. Configure HTTPS and set `NODE_ENV=production` when deployed.
- The default Express session store is in-memory and intended for coursework/local use. Use a persistent session store for production.
- Add CSRF protection, rate limiting, account recovery, audit logging, and stronger operational monitoring before public deployment.
- Do not expose database credentials in front-end code.

## Troubleshooting

- **Database connection failed:** confirm MySQL is running, the database exists, and `.env` values are correct.
- **Cannot find module:** run `npm install` inside the project folder.
- **Port is in use:** change `PORT` in `.env`.
- **Tables missing:** re-run `database.sql`.
