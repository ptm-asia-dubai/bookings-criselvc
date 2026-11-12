# CriselVC

Landing page and bookings for CriselVC, published from `public/` to [criselvc.netlify.app](https://criselvc.netlify.app).

The site is the official identity: Stage Black, Signal Red, Chrome Foil, the `criselVC` wordmark, and the 2026 EPK copy. Booking email and Instagram stay as the EPK placeholders. The inquiry form is `criselvc-inquiry`, with Artist, Creative, and Trader lanes.

Availability and inquiry automation already live in this repo and are separate from the page:

- `netlify/functions/availability.mts` serves `GET /api/availability?month=YYYY-MM`
- `apps-script/` is the Apps Script backend

`AVAILABILITY_ICS_URL` and `WEBHOOK_KEY` are set in Netlify and Apps Script. They are not stored in this repository.
