# StayEasy — Frontend

React 19 + Vite single-page app for the StayEasy hotel booking system. It talks to the
refined StayEasy backend (separate ZIP) over `VITE_API_URL`.

## Quick start

```bash
cp .env.example .env        # set VITE_API_URL (default http://localhost:5000/api)
npm install
npm run dev                 # http://localhost:5173
```

| Script            | What it does                                   |
|-------------------|------------------------------------------------|
| `npm run dev`     | Vite dev server                                |
| `npm run build`   | Production build into `dist/`                  |
| `npm run lint`    | Oxlint                                         |
| `npm test`        | Vitest (guards, redirects, uploader, services) |

The only frontend variable is `VITE_API_URL`. **Cloudinary credentials are never configured
here**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and
`CLOUDINARY_UPLOAD_FOLDER` live in the backend `.env`. The browser only receives a one-time
signature from `POST /api/uploads/signature`.

## Areas and routes

| Area   | Routes | Guard |
|--------|--------|-------|
| Public | `/`, `/hotels`, `/hotels/:id` | none |
| Auth   | `/login`, `/register` | `GuestRoute` (signed-in people are redirected on) |
| Booking | `/booking`, `/booking/confirmation/:id` | `ProtectedRoute` (customers only) |
| My Account | `/account`, `/account/bookings`, `/account/bookings/:id`, `/account/reviews`, `/account/profile`, `/account/profile/edit`, `/account/password`, `/account/close` | `ProtectedRoute` + `AccountLayout` |
| Admin Panel | `/admin`, `/admin/hotels`, `/admin/rooms`, `/admin/bookings`, `/admin/users`, `/admin/reviews`, `/admin/profile` | `AdminRoute` + `AdminLayout` |

`/my-bookings` and `/profile` redirect to their new `/account/...` URLs.

### Redirect rules (`src/utils/auth.js`)
* Admin login → Admin Dashboard (or the admin page they asked for).
* User login → the exact page they came from, query string included (so a booking resumes at
  `/booking?hotel=…&room=…`), otherwise `/account`.
* A role is never sent into the other role's area. Admins opening customer pages go to `/admin`;
  users opening admin pages go to `/account`.

## Backend contracts used

`GET /users/dashboard`, `DELETE /users/me` (password in the JSON body), `GET /reviews/my`,
`PUT /admin/users/:id/status`, `GET /admin/users`, `GET /admin/dashboard` (`bookedRevenue` is
shown as *booked value of confirmed + completed bookings*, not money received),
`POST /uploads/signature`, plus the existing auth, hotel, room, booking, review and profile endpoints.

### Cloudinary upload flow (`src/services/uploadService.js`, `components/uploads/ImageUploader.jsx`)
1. `POST /api/uploads/signature` (admin JWT) → `{ cloudName, apiKey, timestamp, folder, signature, uploadUrl }`.
2. Browser `POST`s `file`, `api_key`, `timestamp`, `folder`, `signature` as multipart form data to
   `uploadUrl`. No upload preset is used (the backend signs only `folder` + `timestamp`).
3. The returned `secure_url` (HTTPS) is added to the form; saving sends the `images` array through the
   existing hotel/room create/update endpoints (max 20). Existing images are kept unless removed.
4. A `503` from the signature endpoint shows a configuration message; pasting an HTTPS URL still works.

## Testing notes
`npm test` runs against mocked services and jsdom. It does not call a real backend, MongoDB or Cloudinary.
