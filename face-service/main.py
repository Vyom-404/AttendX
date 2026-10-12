from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

app = FaceAnalysis(
    name="buffalo_l",
    addons=["liveness"],
    liveness_mode="normal",
)
app.prepare(ctx_id=0, det_size=(640, 640))

ENROLLMENT_DIR = Path("samples/enrollment")
VERIFICATION_DIR = Path("samples/verification")
MIN_ENROLLMENT_PHOTOS = 3


def get_live_embedding(path):
    image = cv2.imread(str(path))
    if image is None:
        return None, "could not read image"

    faces = app.get(image)
    if len(faces) != 1:
        return None, f"expected one face; found {len(faces)}"

    face = faces[0]
    result = face.liveness

    if result is None:
        return None, "liveness result missing"

    if result.status == "input_rejected":
        reason = getattr(result, "reason", "insufficient image input")
        return None, f"liveness input rejected: {reason}"

    if result.status != "ok":
        return None, f"liveness status: {result.status}"

    if not result.is_live:
        return None, f"liveness classified as fake; score={result.live_score:.4f}"

    embedding = face.embedding
    if embedding is None:
        return None, "face embedding unavailable"

    norm = np.linalg.norm(embedding)
    if norm == 0:
        return None, "invalid face embedding"

    return embedding / norm, None


def make_template(student_id, folder):
    embeddings = []

    for path in sorted(folder.glob("*.jpg")):
        embedding, error = get_live_embedding(path)

        if error:
            print(f"Enrollment skipped {path}: {error}")
            continue

        embeddings.append(embedding)

    if len(embeddings) < MIN_ENROLLMENT_PHOTOS:
        raise ValueError(
            f"{student_id} has only {len(embeddings)} usable enrollment photos"
        )

    template = np.mean(embeddings, axis=0)
    norm = np.linalg.norm(template)

    if norm == 0:
        raise ValueError(f"{student_id} has an invalid enrollment template")

    return template / norm


if not ENROLLMENT_DIR.is_dir():
    raise FileNotFoundError(f"Enrollment folder not found: {ENROLLMENT_DIR}")

if not VERIFICATION_DIR.is_dir():
    raise FileNotFoundError(f"Verification folder not found: {VERIFICATION_DIR}")


templates = {}

for folder in sorted(ENROLLMENT_DIR.iterdir()):
    if folder.is_dir():
        templates[folder.name] = make_template(folder.name, folder)
        print(f"{folder.name}: enrollment complete")

if not templates:
    raise ValueError(f"No student enrollment folders found in {ENROLLMENT_DIR}")


for student_folder in sorted(VERIFICATION_DIR.iterdir()):
    if not student_folder.is_dir():
        continue

    expected_student = student_folder.name

    for path in sorted(student_folder.glob("*.jpg")):
        embedding, error = get_live_embedding(path)

        if error:
            print(f"{path}: rejected — {error}")
            continue

        scores = {
            student_id: float(np.dot(template, embedding))
            for student_id, template in templates.items()
        }

        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        score_text = ", ".join(
            f"{student_id}={score:.4f}" for student_id, score in ranked
        )

        print(
            f"{path}: expected={expected_student}, "
            f"top_match={ranked[0][0]}, scores=({score_text})"
        )