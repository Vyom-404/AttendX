# AttendX Admin Portal

This is the standalone web portal for wardens. The Expo app remains in `mobile/` for student attendance and warden access from a phone. Both clients use the same Node API in `api/`.

## Local setup

1. Copy `.env.example` to `.env` and fill the Firebase Web app values. You can reuse the public values from `mobile/.env`; do not put a Firebase Admin private key here.
2. Add `http://localhost:5173` and `http://127.0.0.1:5173` to `WEB_ORIGINS` in the API's root `.env` if that variable is already set there.
3. Start the API from `api/` with `npm run dev`.
4. Install the portal dependencies and start Vite:

   ```bash
   cd admin
   npm install
   npm run dev
   ```

Open the local address Vite prints (normally `http://localhost:5173`). Only accounts with the AttendX `admin` role can open the portal.

Firebase keeps the web sign-in session across browser restarts. The API access token lasts seven days by default; the portal exchanges the restored Firebase session for a fresh API token on startup.

## Deployment

Build with `npm run build` from `admin/` and deploy the generated `dist/` directory as a static site. Set `VITE_API_URL` and the six `VITE_FIREBASE_*` values in the hosting provider. Add the deployed site origin to the API's `WEB_ORIGINS` and to Firebase Authentication's authorized domains.
