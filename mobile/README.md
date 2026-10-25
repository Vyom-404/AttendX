# AttendX mobile app

This Expo app contains the student home screen and hostel admin dashboard. It currently uses the backend's development-only sign-in route. Google sign-in and the in-app camera/location capture flow are the next app features.

## Run it locally

1. Set the API URL in `mobile/.env` (copy `mobile/.env.example`). For a physical phone, set `API_HOST=0.0.0.0` in the root `.env` and use your Mac's local network IP instead of `localhost`.
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

Open Expo Go on a device, or press `w` in the Expo terminal for the web dashboard.

## Development sign-in

The temporary sign-in asks for a student ID and the server-side `DEV_LOGIN_SECRET`. It is not the student sign-in design and must not be used in a deployed app. The secret is typed at runtime and is not bundled in the app. An account needs the server-side `admin` role to open the dashboard.

The dashboard reads session and attendance data from the API. Room numbers are optional and come from the private `api/students.json` manifest. Add a `roomNumber` for each student and run `npm run sync:roster` from `api/` to update them without reprocessing face photos.
