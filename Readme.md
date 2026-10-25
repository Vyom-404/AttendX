# AttendX

AttendX is a student attendance app we are building. The goal is for a student to
open the mobile app during an attendance session, take a fresh selfie in the
app, and have the backend check that the face is live and matches that student's
saved face template.

## How the parts fit together

Think of AttendX as three programs that will work together:

| Part | What it does | Current status |
| --- | --- | --- |
| `mobile/` | The Expo app students use to view sessions and check their attendance; it also contains the hostel admin dashboard. | Student camera capture and foreground location submission are integrated with the API. Google sign-in and physical-device flow validation remain. |
| `api/` | The Node.js/Express backend. It handles authentication, sessions, location policy, attendance, and reports. | MVP API routes and MongoDB records are implemented, including optional room numbers in session rosters and exports. |
| `face-service/` | The Python service that uses InsightFace to detect faces, check liveness, and make/compare face templates. | Local photo checks and HTTP endpoints are set up. |
| MongoDB Atlas | Stores student accounts, face templates, hostel policy, sessions, attendance, and audit events. | Four named student templates are saved; attendance collections/indexes are created by the API. |

### A few terms in plain language

- **Uvicorn** runs the Python face service so other programs can send it images.
- **Express** runs the Node.js backend. It will coordinate the app, face service,
  and MongoDB.
- **Embedding** is a list of 512 numbers InsightFace creates from a face. It acts
  like a compact mathematical representation for comparing faces; it is not the
  original photo.
- **Template** is the single embedding made by averaging several usable
  reference-photo embeddings for one student.
- **Liveness** checks whether the submitted camera image appears to show a live
  person. It is a useful check, but it should not be treated as perfect proof by
  itself.

**Model license:** The InsightFace library code and its pretrained weights have
different terms. InsightFace states that its public pretrained model packs,
including `buffalo_l`, are for non-commercial research use; commercial use needs
separate authorization. Check the [official model-zoo license notice](https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md)
before any use beyond a non-commercial student project. The RGB liveness addon
is distributed separately; check its [applicable notices](https://github.com/deepinsight/insightface/blob/master/python-package/docs/liveness.md)
as well.

## What happens when reference photos are imported

The current importer is a local command for preparing the students whose
reference photos you already have. It is not a screen or endpoint that students
use to enroll themselves.

1. You list each student's ID, name, and photo-folder name in `api/students.json`.
2. The importer sends that folder's JPEG/PNG photos to the Python face service
   running on your computer.
3. InsightFace checks the photos, rejects unusable or non-live images, and
   creates one 512-number template from the accepted photos.
4. The importer saves the student record and template in MongoDB's `students`
   collection. The original photos are not saved to MongoDB by this importer.

A saved record is conceptually like this (the vector below is shortened):

```text
studentId: "student_01"
name: "Student One"
status: "active"
faceTemplate:
  model: "buffalo_l"
  dimension: 512
  embedding: [512 numbers; abbreviated]
  acceptedImages: 5
```

The `students` collection and its unique student-ID index are created when the
backend or importer connects to MongoDB. MongoDB creates the database when the
first collection or record is created.

## Node API that is implemented

The Node API, rather than the mobile app, makes the final attendance decision.
It authenticates the account, checks the session and hostel, validates the
location fix and geofence on the server, sends the camera image and stored
template to the private Python service, applies a configurable face threshold,
and writes one attendance record. It never trusts a client-provided
`faceVerified`, `livenessPassed`, or `locationVerified` flag.

The selfie is held in memory while it is forwarded to the Python service. The
Node API does not write the capture to disk or MongoDB. The audit record stores
safe outcome codes and a minimized location summary, not the exact coordinates
or face embedding.

The API currently requires three still frames. The planned mobile camera should
capture them in quick succession. The Python service performs its liveness
check and face comparison on each frame; the Node API uses the median of the
three similarity scores. This is a small-project baseline, not a guarantee
against video replay or camera injection.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/dev-session` | Development-only sign-in for an imported student account. |
| `GET` | `/me` | Current account and whether a face template is available. |
| `GET` | `/sessions/active` | Current session for the signed-in student's hostel. |
| `POST` | `/attendance` | Multipart 3-frame camera capture + session + fresh location; server checks and records attendance. |
| `GET` | `/attendance/me` | Signed-in student's own attendance and recent rejection reasons. |
| `POST` | `/admin/sessions` | Create a session for an assigned hostel. |
| `GET` | `/admin/sessions` | List sessions for assigned hostels. |
| `PATCH` | `/admin/sessions/:id` | Update or close an assigned session. |
| `GET` | `/admin/sessions/:id/attendance` | Session roster with present/absent status. |
| `GET` | `/admin/sessions/:id/attempts` | Safe rejection reason codes for a session. |
| `GET` | `/admin/sessions/:id/export` | Download the assigned session roster as CSV. |
| `PATCH` | `/admin/sessions/:id/attendance/:attendanceId/review` | Add a manual-review note to a record. |

The attendance collection has a unique `{ studentId, sessionId }` index, so
concurrent duplicate submissions cannot create two present records. The server
uses its own clock for session eligibility. Rejected attendance attempts are
audited without storing their uploaded images.

### Development sign-in and admin access

The college identity provider has not been selected, so the current sign-in
route is **development-only**. It requires `ENABLE_DEV_LOGIN=true` and the
server-only `DEV_LOGIN_SECRET` in the root `.env`, and issues a short-lived
signed token. Never put this shared secret in the Expo app. Production sign-in
must use the college identity provider or another real authentication flow.
The local `.env` has private development secrets; the actual values are not in
this README or `.env.example`.

Imported students receive the `student` role. The private manifest may include
an optional `roomNumber` for admin rosters and exports. To grant a student admin access
from a trusted local terminal after starting the API once, run:

```bash
cd api
npm run grant-admin -- student_01
```

Replace `student_01` with the account authorized to administer the hostel. The
admin's hostel assignment is stored server-side; the client cannot grant itself
roles. Use this only when the student account should also have admin privileges.

To create a separate administrator account, use a distinct `admin_...` ID. This
command moves the supplied email link off the student account while leaving its
student role intact:

```bash
npm run create-admin -- admin_vyom "Vyom Gupta" YOUR_GOOGLE_EMAIL student_01
```

The admin account can use the temporary development sign-in with `admin_vyom`.
Google email sign-in will work after the Google authentication route is added.

### Hostel location and face threshold configuration

The local `.env` currently contains an initial Uniworld pin and a 150 m radius,
with a 50 m maximum GPS accuracy and 30-second maximum fix age. Treat these as
starting values and validate them with real phone GPS fixes inside and outside
the hostel before relying on them. Keep the real location settings in the local
`.env`; the tracked example uses placeholders:

```env
HOSTEL_ID=hostel_demo
HOSTEL_NAME=Your Hostel Name
HOSTEL_CENTER_LAT=SET_ME
HOSTEL_CENTER_LON=SET_ME
HOSTEL_RADIUS_METERS=SET_ME
HOSTEL_MAX_ACCURACY_METERS=SET_ME
HOSTEL_MAX_FIX_AGE_SECONDS=SET_ME
```

The API seeds a valid geofence into MongoDB on startup. Until the geofence is
configured, attendance submissions fail safely. `FACE_MATCH_THRESHOLD` is
currently `0.70` as a development starting point. It must be evaluated against
genuine and different-person captures before relying on it for the demo.

The current attendance request is authenticated multipart data. It sends
`sessionId`, `latitude`, `longitude`, `accuracyMeters`, `locationTimestamp`, and
three repeated `captures` image fields. The client sends no face-match or
geofence pass/fail flags; the API computes those decisions.

## Import the current student photos

### 1. Prepare a private student list

Copy `api/students.example.json` to `api/students.json`. Edit the names and IDs
to match your students. The `folder` value must match a folder under
`face-service/samples/enrollment/`.

For example, `"folder": "student_01"` means the photos go in:

```text
face-service/samples/enrollment/student_01/
```

Put 3–10 clear JPEG or PNG reference photos in each folder. Both
`face-service/samples/` and `api/students.json` are excluded from Git, so your
photos and private student list are not committed.

### 2. Start the Python face service

From the project root, in Terminal 1:

```bash
cd face-service
source .venv/bin/activate
python -m uvicorn face_service.api:app --host 127.0.0.1 --port 8000
```

Leave this terminal running. Uvicorn is now listening for requests from your
computer. The interactive face-service page is at
`http://127.0.0.1:8000/docs`.

### 3. Import and save templates

From the project root, in Terminal 2:

```bash
cd api
npm run import:students
```

The importer connects to MongoDB using `MONGODB_URI` from the root `.env`. You
do not need to run the Express server for this command. A successful import
prints one “template saved” message per student. Running it again for an existing
student ID replaces that student's template.

### 4. Run the Express API

From the project root, in another terminal:

```bash
cd api
npm run dev
```

The API creates its indexes and imported student-account records on startup.
Open `http://localhost:3000/health`. A response with
`"database":"connected"` means the backend can reach MongoDB.

### 5. Run the Expo app

In a separate terminal:

```bash
cd mobile
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to the computer running the API. Use
`http://localhost:3000` for the web app on that same computer; for a phone on
the same Wi-Fi, use the computer's local network IP instead. Then run:

```bash
npm start
```

The API allows the local Expo web origins on ports 8081 by default. If you open
the web app using a LAN IP or a different port, add that full origin to
`WEB_ORIGINS` in the root `.env`, separated from any existing origins by a comma.
For Expo Go on a physical phone, the API must also listen on the local network:
temporarily set `API_HOST=0.0.0.0` in the root `.env`, then use the computer's
LAN IP in `mobile/.env` (for example, `http://192.168.1.20:3000`).

Open the link in Expo Go or press `w` in the Expo terminal for the web version.
The current sign-in screen is for local development and requires a student ID
plus `DEV_LOGIN_SECRET` typed at runtime. Google sign-in is not connected yet.
An account needs the server-side `admin` role to open the admin dashboard.

To show room numbers in the roster, add an optional `roomNumber` to each entry
in the private `api/students.json`, then run `npm run sync:roster` from `api/`.
This updates roster details without reprocessing face photos. Leave
`roomNumber` empty if a room is not assigned.

## Keep secrets and biometric data private

- Put the real MongoDB connection string in the root `.env`; never paste it into
  chat or commit it to Git.
- `.env.example` shows the variable names and placeholder format only.
- Keep student photos and `api/students.json` private. They are gitignored.
- The current enrollment importer is a local developer tool. Do not expose it as
  a public student endpoint.

## What is not built yet

- Google sign-in and physical-device end-to-end validation of camera/location attendance.
- A production college identity provider; current sign-in is for local development.
- Room numbers have not yet been filled into the private student manifest.
- Production deployment and a full evaluation report.
- Face-match threshold calibration with a larger, representative photo set.
