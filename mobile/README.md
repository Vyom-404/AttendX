# AttendX mobile app

This Expo app contains student attendance check-in and the hostel admin dashboard. Android students and wardens, and web wardens, sign in with Google through Firebase Authentication. Students can use the in-app front camera and foreground location to submit attendance to the API.

## Run it locally

1. Set the API URL and Firebase Web app config in `mobile/.env` (copy the variable names from `mobile/.env.example`). For a physical phone, set `API_HOST=0.0.0.0` in the root `.env` and use your Mac's local network IP instead of `localhost`.
2. In one terminal, start the Node API:

   ```bash
   cd api
   npm run dev
   ```

3. In a second terminal, start Expo:

   ```bash
   cd mobile
   npm start
   ```

Press `w` in the Expo terminal for the web dashboard. Expo Go still works for other mobile development, but native Google sign-in requires an EAS development build. From `mobile/`, run `npx eas-cli@latest build:configure`, then `npx eas-cli@latest build --platform android --profile development`. EAS will ask you to sign in and create the Android signing key.

## Google sign-in

Android students and wardens, and web wardens, sign in with their linked Google account. The API accepts a Firebase ID token only when its verified email matches an active AttendX account. Web accepts only accounts with the server-side `admin` role. Add the Firebase Web app's public config values to `mobile/.env`; never put the Firebase Admin private key in the Expo app.

The dashboard reads session and attendance data from the API. Room numbers are optional and come from the private `api/students.json` manifest. Add a `roomNumber` for each student and run `npm run sync:roster` from `api/` to update them without reprocessing face photos.

## Student attendance check-in

During an active session, a student opens **Open camera to check in**, grants camera permission, and captures three frames from the front camera. The app does not provide a gallery picker. On submit, it requests a fresh foreground location and sends the frames and location fix to `POST /attendance`. The API checks the session, geofence, liveness, and face match before recording attendance. Use a physical phone with camera and location enabled for this flow.
