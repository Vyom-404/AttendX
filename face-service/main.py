import cv2
import numpy as np
from insightface.app import FaceAnalysis

app = FaceAnalysis(
    name="buffalo_l",
    addons=["liveness"],
    liveness_mode="normal",
)
app.prepare(ctx_id=0, det_size=(640, 640))


def get_one_face(path):
    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"Could not read image: {path}")

    faces = app.get(image)
    if len(faces) != 1:
        raise ValueError(f"Expected one face in {path}; found {len(faces)}")

    return faces[0]


def normalized_embedding(face):
    if face.embedding is None:
        raise ValueError("No face embedding was produced")

    embedding = face.embedding
    return embedding / np.linalg.norm(embedding)


reference = get_one_face("samples/reference.jpg")

if reference.liveness.status != "ok" or not reference.liveness.is_live:
    raise ValueError("Reference photo did not pass liveness")

reference_embedding = normalized_embedding(reference)

for path in [
    "samples/same_person.jpg",
    "samples/other_person.jpg",
    "samples/screen_replay.jpg",
]:
    face = get_one_face(path)
    liveness = face.liveness

    if liveness.status != "ok" or not liveness.is_live:
        print(f"{path}: rejected by liveness")
        continue

    candidate_embedding = normalized_embedding(face)
    score = float(np.dot(reference_embedding, candidate_embedding))
    print(f"{path}: liveness passed; face similarity={score:.4f}")