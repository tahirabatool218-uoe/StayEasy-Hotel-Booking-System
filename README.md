# StayEasy — Hotel Booking and Management System

A full-stack MERN hotel booking and management application that allows guests to explore hotels, check room availability, make bookings, manage their trips, and write reviews. Administrators can manage hotels, rooms, bookings, users, and reviews through a dedicated admin dashboard.

## Live Demo

- **Live Website:** [StayEasy](YOUR_FRONTEND_URL)
- **Backend API:** [StayEasy API](YOUR_BACKEND_URL)

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Cloudinary Image Uploads](#cloudinary-image-uploads)
- [Booking and Status Rules](#booking-and-status-rules)
- [Testing](#testing)
- [Deployment](#deployment)
- [Initial Admin Setup](#initial-admin-setup)
- [Security](#security)
- [License](#license)

## Features

### Guest Features

- Browse and search hotels.
- Filter hotels by city, country, price range, minimum rating, and amenities.
- Sort and paginate hotel listings.
- View hotel details, image galleries, available rooms, and customer reviews.
- Check room availability for selected dates.
- Create bookings with date, guest-count, and price validation.
- Prevent overlapping bookings for the same room.
- View trip statistics and booking history from the account dashboard.
- View booking details and cancel eligible bookings.
- Write, update, and delete personal reviews.
- Upload, preview, change, or remove a profile photo.
- Update profile information and change passwords.
- Close an account.
- Access account options through the profile menu in the navigation bar.

### Admin Features

- View dashboard statistics, booking breakdowns, recent bookings, and recent reviews.
- Create, update, activate, deactivate, and manage hotels.
- Create and manage rooms, including prices, amenities, descriptions, and images.
- View bookings and update booking statuses.
- Delete bookings where permitted.
- Search users and manage their roles and account statuses.
- Activate or deactivate user accounts.
- Moderate reviews by making them visible or hidden.
- Update admin profile information and profile photos.
- Change the admin password.

### Image Management

- Upload hotel, room, and profile images directly to Cloudinary.
- Generate upload signatures through the backend.
- Keep the Cloudinary API secret on the server.
- Restrict hotel and room image uploads to administrators.
- Allow authenticated users to upload their own profile photos.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, React Router, Axios |
| Styling | Plain CSS, reusable design system, light/dark theme |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose |
| Authentication | JWT Bearer tokens, bcrypt password hashing |
| Image Storage | Cloudinary signed direct uploads |
| Backend Testing | Node.js built-in test runner (`node:test`) |
| Frontend Testing | Vitest, Testing Library |
| Linting | Oxlint |

## Project Structure

```text
hotel-booking-system/
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── server.js
│   ├── scripts/
│   │   ├── bookingData.js
│   │   ├── checkBookingData.js
│   │   ├── checkRoomData.js
│   │   ├── createBookingStayIndex.js
│   │   ├── createRoomIndex.js
│   │   ├── roomData.js
│   │   ├── seed.js
│   │   ├── seedCredentials.js
│   │   └── syncRoomCounts.js
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── env.js
│   │   ├── controllers/
│   │   │   ├── adminController.js
│   │   │   ├── authController.js
│   │   │   ├── bookingController.js
│   │   │   ├── hotelController.js
│   │   │   ├── reviewController.js
│   │   │   ├── roomController.js
│   │   │   ├── uploadController.js
│   │   │   └── userController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── optionalAuth.js
│   │   │   ├── roleMiddleware.js
│   │   │   └── security.js
│   │   ├── models/
│   │   │   ├── Booking.js
│   │   │   ├── Hotel.js
│   │   │   ├── Review.js
│   │   │   ├── Room.js
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── adminRoute.js
│   │   │   ├── authRoutes.js
│   │   │   ├── bookingRoute.js
│   │   │   ├── hotelRoute.js
│   │   │   ├── reviewRoute.js
│   │   │   ├── roomRoute.js
│   │   │   ├── uploadRoute.js
│   │   │   └── userRoute.js
│   │   ├── utils/
│   │   │   ├── bookingAvailability.js
│   │   │   ├── bookingValidation.js
│   │   │   ├── cloudinarySignature.js
│   │   │   ├── escapeRegExp.js
│   │   │   ├── generateToken.js
│   │   │   ├── httpErrors.js
│   │   │   ├── profileImage.js
│   │   │   ├── roomCounts.js
│   │   │   ├── validators.js
│   │   │   └── ...
│   │   └── ...
│   └── tests/
│       ├── bookingStayKeys.test.js
│       ├── bookingValidation.test.js
│       ├── integrity.integration.test.js
│       ├── phase1.integration.test.js
│       ├── phase1.unit.test.js
│       ├── profileImage.unit.test.js
│       ├── security.integration.test.js
│       ├── security.unit.test.js
│       ├── seedCredentials.unit.test.js
│       └── step3.unit.test.js
├── frontend/
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Footer.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── UserMenu.jsx
│   │   │   ├── account/
│   │   │   ├── admin/
│   │   │   ├── bookings/
│   │   │   ├── home/
│   │   │   ├── hotels/
│   │   │   ├── reviews/
│   │   │   ├── rooms/
│   │   │   ├── ui/
│   │   │   ├── uploads/
│   │   │   └── ...
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/
│   │   │   ├── useApiData.js
│   │   │   └── useDebouncedValue.js
│   │   ├── layouts/
│   │   │   ├── AccountLayout.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── PublicLayout.jsx
│   │   │   └── UserLayout.jsx
│   │   ├── pages/
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── account/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── public/
│   │   │   └── user/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   └── tests/
│       ├── auth.test.js
│       ├── avatar.test.jsx
│       ├── avatarService.test.js
│       ├── guards.test.jsx
│       ├── passwordInput.test.jsx
│       ├── services.test.js
│       ├── setup.js
│       ├── uploader.test.jsx
│       └── userMenu.test.jsx
├── README.md
└── .git/
```

The project is split into a backend API and a frontend application. The backend handles authentication, hotel/room/booking logic, validation, and image uploads, while the frontend handles user-facing pages, reusable UI components, layouts, routes, and API integration.

## Getting Started

### Prerequisites

Install the following before running the application:

- Node.js 20 or later.
- npm.
- MongoDB locally or a MongoDB Atlas database.
- A Cloudinary account for image uploads.

### 1. Clone the Repository

```bash
git clone https://github.com/tahirabatool218-uoe/StayEasy-Hotel-Booking-System.git
cd hotel-booking-system
```


### 2. Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

On Windows Command Prompt, you can use:

```cmd
copy .env.example .env
```

Add your database connection string, JWT secret, and other required configuration to `backend/.env`.

### 3. Start the Backend

```bash
npm run dev
```

The backend uses port `5000` by default.

Base API URL:

```text
http://localhost:5000/api
```

### 4. Configure the Frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

Set the backend API URL in `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Start the Frontend

```bash
npm run dev
```

Vite normally serves the frontend at:

```text
http://localhost:5173
```

Open the URL shown in your terminal to use the application.

## Environment Variables

### Backend Configuration

Create `backend/.env` and configure the variables supported by your application.

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string. Required. |
| `JWT_SECRET` | Secret used to sign JWTs. Required; use a strong secret of at least 32 characters. |
| `PORT` | Backend port. Defaults to `5000`. |
| `NODE_ENV` | Application environment, such as `development` or `production`. |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins for production. |
| `BOOKING_TIMEZONE` | Time zone used for booking-related operations. Defaults to `Asia/Karachi`. |
| `TRUST_PROXY` | Proxy trust configuration when deployed behind a reverse proxy. |
| `BCRYPT_ROUNDS` | Password-hashing cost configuration. |
| `API_RATE_LIMIT_MAX` | General API rate-limit configuration. |
| `AUTH_RATE_LIMIT_MAX` | Authentication rate-limit configuration. |
| `AUTH_REGISTER_LIMIT_MAX` | Registration rate-limit configuration. |
| `JSON_BODY_LIMIT` | Maximum accepted JSON request-body size. |
| `SEED_ADMIN_EMAIL` | Admin email used by the seed script. |
| `SEED_ADMIN_PASSWORD` | Admin password used by the seed script. |
| `SEED_USER_EMAIL` | Test or sample user email used by the seed script. |
| `SEED_USER_PASSWORD` | Test or sample user password used by the seed script. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Private Cloudinary API secret; server-side only. |
| `CLOUDINARY_UPLOAD_FOLDER` | Root folder for uploaded images. Defaults to `stayeasy`. |

Some security and seed variables are optional, depending on the script or deployment configuration. Check `backend/.env.example` and the backend configuration files for the exact supported settings.

Generate a strong JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Never commit your real `.env` files to GitHub.

### Frontend Configuration

Configure `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

For deployment, change the value to your deployed backend API URL.

Only expose values intended for browser use through frontend environment variables. Never place the MongoDB URI, JWT secret, or Cloudinary API secret in the frontend.

## API Overview

All endpoints use the `/api` base path.

- **Public:** Available without authentication unless otherwise noted.
- **Authenticated:** Requires a valid JWT Bearer token.
- **Admin:** Requires authentication and the admin role.

### Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a guest account |
| POST | `/auth/login` | Public | Sign in |
| GET | `/auth/me` | Authenticated | Get the current user's session information |

### Users and Account

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/users/profile` | Authenticated | Get the current user's profile |
| PUT | `/users/profile` | Authenticated | Update profile details and profile image |
| GET | `/users/dashboard` | Authenticated | Get account dashboard information |
| PUT | `/users/change-password` | Authenticated | Change password |
| DELETE | `/users/me` | Authenticated | Close the current user's account |

### Hotels

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/hotels` | Public | Browse, search, filter, sort, and paginate hotels |
| GET | `/hotels/:id` | Public | Get hotel details |
| POST | `/hotels` | Admin | Create a hotel |
| PUT | `/hotels/:id` | Admin | Update a hotel |
| DELETE | `/hotels/:id` | Admin | Delete a hotel when permitted |

### Rooms

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/rooms` | Public | Browse rooms |
| GET | `/rooms/availability` | Public | Check room availability |
| GET | `/rooms/:id` | Public | Get room details |
| POST | `/rooms` | Admin | Create a room |
| PUT | `/rooms/:id` | Admin | Update a room |
| DELETE | `/rooms/:id` | Admin | Delete a room when permitted |

### Bookings

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/bookings` | Authenticated | Create a booking |
| GET | `/bookings/my` | Authenticated | Get the current user's bookings |
| GET | `/bookings/:id` | Authenticated | Get an authorized booking's details |
| PUT | `/bookings/:id` | Authenticated | Update a booking where permitted |
| GET | `/bookings` | Admin | View bookings across the system |
| DELETE | `/bookings/:id` | Admin | Delete a booking |

### Reviews

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/reviews` | Authenticated | Submit a review |
| GET | `/reviews/my` | Authenticated | Get the current user's reviews |
| GET | `/reviews/hotel/:hotelId` | Public | Get reviews for a hotel |
| PUT | `/reviews/:id` | Authenticated | Update an authorized review |
| DELETE | `/reviews/:id` | Authenticated | Delete an authorized review |
| GET | `/reviews` | Admin | View and moderate reviews |

### Admin Dashboard and User Management

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin | Dashboard statistics |
| GET | `/admin/recent-bookings` | Admin | Recent bookings |
| GET | `/admin/recent-reviews` | Admin | Recent reviews |
| GET | `/admin/hotels` | Admin | Hotel management data |
| GET | `/admin/users` | Admin | Search and view users |
| PUT | `/admin/users/:id/role` | Admin | Update a user's role |
| PUT | `/admin/users/:id/status` | Admin | Activate or deactivate an account |
| DELETE | `/admin/users/:id` | Admin | Delete a user when permitted |

### Image Uploads

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/uploads/signature` | Admin | Generate a signature for hotel and room image uploads |
| POST | `/uploads/signature` | Authenticated | Generate a signature for the caller's own profile photo when the body contains `purpose: "avatar"` |

The upload signature endpoint uses role-aware authorization. Profile photo requests are scoped to the authenticated user's own image.

**Note:** The tables summarize the project's API routes. For exact request bodies, query parameters, validation rules, and response formats, refer to the corresponding backend route and controller files.

## Cloudinary Image Uploads

StayEasy uses **Cloudinary signed direct uploads**. The browser uploads images directly to Cloudinary, while the backend generates the required signature.

### Upload Flow

1. The frontend requests an upload signature from `POST /api/uploads/signature`.
2. The backend authenticates the request and checks whether the user is permitted to upload that type of image.
3. The backend generates a timestamp and signature using the Cloudinary API secret.
4. The frontend receives the upload details, including the cloud name, API key, timestamp, folder, signature, and upload URL.
5. The browser uploads the image directly to Cloudinary using the signed parameters.
6. The resulting HTTPS image URL is saved through the relevant application API.

### Upload Permissions

- Hotel and room image signatures are restricted to administrators.
- Authenticated users may request an avatar signature for their own profile photo.
- Profile-image parameters are generated using the authenticated user's verified ID rather than an arbitrary user ID supplied by the client.
- The Cloudinary API secret remains on the backend and is never sent to the browser.

If Cloudinary credentials are missing, the backend returns a service-unavailable response for upload-signature requests.

Profile-photo removal clears the saved profile-image reference from the database. The corresponding Cloudinary asset may remain in Cloudinary until separately deleted.

## Booking and Status Rules

### Booking Statuses

- `pending`
- `confirmed`
- `completed`
- `cancelled`

### Room Statuses

- `available`
- `maintenance`
- `inactive`

### Review Statuses

- `visible`
- `hidden`

The application validates booking dates, guest counts, and pricing. Overlapping bookings for the same room are prevented by the booking rules. Hotel ratings are calculated on the server, and hotels or rooms with associated bookings or reviews cannot be hard-deleted where the application's deletion rules prohibit it.

## Testing

StayEasy includes backend tests using Node.js's built-in test runner and frontend tests using Vitest and Testing Library.

### Backend Tests

```bash
cd backend
npm test
```

HTTP integration tests that require a database need a dedicated test database configured through `TEST_MONGO_URI`.

Example for a local MongoDB test database:

```bash
TEST_MONGO_URI=mongodb://127.0.0.1:27017/stayeasy_test npm test
```

Use a disposable test database only. Do not point integration tests at production data.

### Frontend Tests

```bash
cd frontend
npm test
```

### Lint and Production Build

```bash
cd frontend
npm run lint
npm run build
```

### Useful Backend Scripts

Run these from the `backend` directory:

```bash
npm run dev
npm start
npm run seed
npm test
npm run rooms:check
npm run rooms:sync-counts
npm run rooms:create-index
npm run bookings:check
npm run bookings:create-index
```

The seed script can create sample hotels, rooms, and accounts when configured with the required seed environment variables. Check `backend/package.json` for the exact behavior of each script before running it.

## Deployment

### Backend

1. Deploy the backend to a Node.js-compatible hosting platform.
2. Configure `MONGO_URI` with the production MongoDB connection string.
3. Set a strong, unique `JWT_SECRET`.
4. Set `NODE_ENV=production`.
5. Configure `CORS_ORIGINS` with the exact deployed frontend origin or origins.
6. Add Cloudinary credentials if image uploads are required.
7. Configure `TRUST_PROXY` correctly if the application runs behind a trusted reverse proxy.
8. Run any required database-index or maintenance scripts according to the deployment plan.

### Frontend

1. Build the frontend:

   ```bash
   cd frontend
   npm run build
   ```

2. Set `VITE_API_URL` to the deployed backend's `/api` URL.
3. Deploy the generated `frontend/dist/` directory to a static hosting service.
4. Configure the hosting platform to serve the frontend application and support client-side routes.

### Production Considerations

- Use HTTPS for the frontend, backend, and image delivery.
- Never expose secrets in the repository or frontend build.
- Configure production CORS origins explicitly.
- Ensure the hosting platform's proxy settings match the backend's `TRUST_PROXY` configuration.
- The default in-memory rate limiter is per process. Multi-instance deployments should use a shared rate-limit store where appropriate.
- Verify database access, Cloudinary uploads, authentication, and booking flows in the deployed environment.

## Initial Admin Setup

Public registration creates a regular user account, not an administrator account.

To create the initial admin, configure the seed administrator credentials in the backend environment and run the seed script:

```bash
cd backend
npm run seed
```

Once an administrator exists, user roles can be managed through the admin interface, subject to the application's authorization rules.

Use a strong password for the initial administrator and avoid committing seed credentials.

## Security

StayEasy includes the following security controls:

- JWT-based authentication for protected endpoints.
- Password hashing with bcrypt.
- Server-side role-based access control for user and admin operations.
- Input validation and booking-rule checks.
- Rate limiting for API and authentication endpoints.
- Helmet security headers, configured CORS, and a JSON request-body size limit.
- Server-side Cloudinary signature generation.
- Protection against unauthorized profile-image assignment.
- Rejection of invalidated authentication tokens after password changes.
- Prevention of sign-in by deactivated accounts.
- Server-computed hotel ratings and safeguards for deleting records associated with bookings or reviews.

Keep all secrets in environment variables and follow the deployment platform's secret-management practices.


**StayEasy** — A full-stack hotel booking and management application built with the MERN stack.