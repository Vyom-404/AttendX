# AttendX mobile app

This Expo app is the phone app for students and wardens. Students can use the in-app front camera and foreground location to submit attendance; wardens can manage sessions from the phone. The standalone laptop/web portal lives in `../admin/`. Both clients use the same API.

## Run it locally

1. Set the API URL in `mobile/.env` (copy the variable names from `mobile/.env.example`). For a physical phone, set `API_HOST=0.0.0.0` in the root `.env` and use your Mac's local network IP instead of `localhost`.
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

Expo Go works for camera/location development, but native Google sign-in requires an EAS development build. From `mobile/`, run `npx eas-cli@latest build:configure`, then `npx eas-cli@latest build --platform android --profile development`. EAS will ask you to sign in and create the Android signing key. For the warden web portal, follow `../admin/README.md`.

## Google sign-in

Students and wardens sign in on the phone with their linked Google account. The API accepts a Firebase ID token only when its verified email matches an active AttendX account. Never put the Firebase Admin private key in the Expo app.

Firebase restores the signed-in Google account when the app restarts. The API access token lasts seven days by default; the app exchanges the restored Firebase session for a fresh API token after startup.

The dashboard reads session and attendance data from the API. Room numbers are optional and come from the private `api/students.json` manifest. Add a `roomNumber` for each student and run `npm run sync:roster` from `api/` to update them without reprocessing face photos.

## Student attendance check-in

During an active session, a student opens **Open camera to check in**, grants camera permission, and captures three frames from the front camera. The app does not provide a gallery picker. On submit, it requests a fresh foreground location and sends the frames and location fix to `POST /attendance`. The API checks the session, geofence, liveness, and face match before recording attendance. Use a physical phone with camera and location enabled for this flow.
