# AttendX

AttendX is a student attendance app we are building. The goal is for a student to
open the mobile app during an attendance session, take a fresh selfie in the
app, and have the backend check that the face is live and matches that student's
saved face template.

## How the parts fit together

Think of AttendX as three programs that will work together:

| Part | What it does | Current status |
| --- | --- | --- |
| `mobile/` | The Expo app students will use to sign in and take a selfie. | Not built yet. |
| `api/` | The Node.js/Express backend. It will handle student accounts, attendance, and database access. | Basic server and MongoDB connection are set up. |
| `face-service/` | The Python service that uses InsightFace to detect faces, check liveness, and make/compare face templates. | Local photo checks and HTTP endpoints are set up. |
| MongoDB Atlas | Stores student records, face templates, and later attendance data. | Connection is configured; student import is ready. |

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

### 4. Run the Express API health check (optional)

From the project root, in another terminal:

```bash
cd api
npm run dev
```

Open `http://localhost:3000/health`. A response with
`"database":"connected"` means the backend can reach MongoDB.

## Keep secrets and biometric data private

- Put the real MongoDB connection string in the root `.env`; never paste it into
  chat or commit it to Git.
- `.env.example` shows the variable names and placeholder format only.
- Keep student photos and `api/students.json` private. They are gitignored.
- The current enrollment importer is a local developer tool. Do not expose it as
  a public student endpoint.

## What is not built yet

- The Expo mobile app and its camera flow.
- Student sign-in and admin authentication.
- Attendance sessions, geofence checks, and duplicate-attendance prevention.
- A complete authenticated flow from a mobile selfie through the backend to a
  final attendance decision.
- Production deployment and face-match threshold calibration with a larger,
  representative photo set.
