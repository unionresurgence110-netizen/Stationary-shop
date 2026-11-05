# OM RIDHI SIDHI STATIONERY SHOP

Full-stack customer shop + owner dashboard. This project follows `Om_Ridhi_Sidhi_Stationery_Project_Requirements.pdf`.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript (responsive; no build step)
- Backend: Node.js 20+, Express
- Database: PostgreSQL (Neon supported)
- Product image storage: Cloudflare R2 (S3-compatible)
- Authentication: bcrypt password hashes + JWT bearer tokens
- Hosting: Render web service (serves both frontend and API)

## Features included
- Email/password registration and login with password visibility; server-side authentication.
- Customer and owner roles; owner APIs are protected by both JWT authentication and database role.
- Product catalogue, categories, tags, search, price/stock/new/discount filters and sorting.
- Independent product Like and Favourite actions; one like per account/product.
- Active offers, golden gift indicator, percentage/fixed discounts calculated in catalogue responses.
- Customer dashboard notifications and reservation history.
- Physical pickup requests; pending requests do not reduce stock; owner approval checks stock transactionally and reserves it for 24 hours.
- Customer cancellation of pending requests; owner can cancel approved reservations; expiry returns stock.
- Suggestions, likes and owner replies/visibility controls.
- Shop Reviews only. Product reviews and their endpoints/tables are removed.
- Owner product/category/offer/reservation/suggestion/shop settings controls.
- Image upload/replacement/deletion endpoint using private R2 credentials on server.
- Light/dark theme toggle.
- No online checkout, delivery or online payment.

## Local setup
1. Install Node.js 20 LTS or newer and PostgreSQL (or create a Neon database).
2. Extract this ZIP. Open a terminal in the project root.
3. Copy `.env.example` to `.env` and set at least `DATABASE_URL` and a long random `JWT_SECRET`.
4. Create database schema by running `backend/schema.sql`.
5. For an existing database, apply migrations in numeric order: `002_feature_completion.sql`, then `003_prd_alignment.sql`. For a fresh database, run schema then both migrations too.
6. Run `npm install`.
7. Run `npm run check` to syntax-check the server and route files.
8. Run `npm start`.
9. Open `http://localhost:3000`.

The homepage and customer/owner pages are served by Express. Do not open individual HTML files with `file://` if you want API-backed functionality; use the local server.

## Owner account setup
1. Register a normal account through `/customer/register.html`.
2. In Neon/PostgreSQL SQL editor, promote only the intended owner:
   `UPDATE users SET role='admin' WHERE email='owner@example.com';`
3. Sign out and sign back in. The owner navigation is available at `/owner/dashboard.html`.
4. Never add public owner registration or expose a role selector in the registration form.

## Environment variables
- `DATABASE_URL`: Neon/PostgreSQL connection string.
- `JWT_SECRET`: long random secret; never share or commit it.
- `JWT_EXPIRES_IN`: optional, default `7d`.
- `CORS_ORIGIN`: comma-separated exact website origins. For same-origin Render hosting, keep the Render origin and local origin.
- `OWNER_EMAIL`: informational deployment variable; role promotion is still performed manually in SQL.
- R2 values are required only for image uploads: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`.

## Render + Neon + Cloudflare R2 deployment
1. Push the extracted project to a private GitHub repository.
2. Create a Neon PostgreSQL project and copy its pooled or direct connection string. Run `backend/schema.sql`, then migrations 002 and 003 in order.
3. Create a Render **Web Service** from the repository. Runtime: Node. Build command: `npm install`. Start command: `npm start`. Node 20+.
4. Add environment variables in Render. Set `NODE_ENV=production`, `DATABASE_URL`, a unique `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `CORS_ORIGIN` to the exact deployed origin, and R2 credentials.
5. Create a Cloudflare R2 bucket. Generate an access key scoped to that bucket. Set a public custom domain for image delivery and use it as `R2_PUBLIC_BASE_URL`. Keep access/secret keys private; never put them in frontend files.
6. After deployment, register the owner and promote that email in Neon as described above.
7. Test `/api/health`, registration, login, product creation, image upload, offer display, like/favourite independence, reservation approval, cancellation, expiry, suggestions and reviews.
8. Add your custom domain to Render/Cloudflare only after the Render URL works. Update `CORS_ORIGIN` if the browser frontend is hosted on a separate origin.

## API overview
- Public: `GET /api/public/products`, `/categories`, `/offers`, `/settings`, `/notices`, `/suggestions`, `/reviews`
- Auth: `POST /api/auth/register`, `/login`, `GET /api/auth/me`
- Customer: `/api/customer/dashboard`, `/favourites`, `/suggestions`, `/notifications`
- Product actions: `POST|DELETE /api/products/:id/like`, `POST|DELETE /api/products/:id/favourite`
- Pickup: `POST /api/reservations`, `POST /api/reservations/:id/cancel`
- Shop review: `POST /api/shop/reviews`
- Owner (admin only): `/api/owner/*`

## Reservation rules
- A new request has `Request Sent` status and does not reduce stock.
- Owner approval locks the reservation/product rows, checks current stock and deducts the quantity atomically.
- Approval sets `expires_at` to 24 hours after approval.
- A worker runs every five minutes inside the Node service and marks expired reservations `Expired`, returning stock and notifying the customer.
- Customers can cancel pending requests. Owner can cancel an approved reservation, returning stock. Completed pickup does not return stock.
- Customer collects and pays at the physical shop. There is no online payment, delivery or shipping.

## Security / production checklist
- Use HTTPS, a unique high-entropy JWT secret and private R2 credentials.
- Restrict CORS to the deployed frontend origin.
- Promote only the actual owner account in SQL; registration always creates customer role.
- Back up Neon and R2. Set usage alerts and test restoration.
- Configure an R2 public custom domain or equivalent public read delivery for image URLs.
- Run `npm run check`, then perform end-to-end tests using real customer and owner accounts before public launch.
- The current workspace does not include live Neon/Render/R2 credentials, so external deployment and database-backed acceptance tests must be completed by the owner in their accounts.
