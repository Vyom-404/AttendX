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

    if result is None or result.status != "ok" or not result.is_live:
        return None, "liveness rejected"

    if face.embedding is None:
        return None, "no face embedding"

    embedding = face.embedding
    return embedding / np.linalg.norm(embedding), None


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
    return template / np.linalg.norm(template)


templates = {}

for folder in sorted(ENROLLMENT_DIR.iterdir()):
    if folder.is_dir():
        templates[folder.name] = make_template(folder.name, folder)
        print(f"{folder.name}: enrollment complete")

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