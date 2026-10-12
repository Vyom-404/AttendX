from pathlib import Path

from face_service.face_engine import FaceEngine

ENROLLMENT_DIR = Path("samples/enrollment")
VERIFICATION_DIR = Path("samples/verification")
MIN_ENROLLMENT_PHOTOS = 3


if not ENROLLMENT_DIR.is_dir():
    raise FileNotFoundError(f"Enrollment folder not found: {ENROLLMENT_DIR}")

if not VERIFICATION_DIR.is_dir():
    raise FileNotFoundError(f"Verification folder not found: {VERIFICATION_DIR}")


templates = {}
engine = FaceEngine()

for folder in sorted(ENROLLMENT_DIR.iterdir()):
    if folder.is_dir():
        templates[folder.name] = engine.make_template(
            folder.name,
            folder,
            minimum_photos=MIN_ENROLLMENT_PHOTOS,
        )
        print(f"{folder.name}: enrollment complete")

if not templates:
    raise ValueError(f"No student enrollment folders found in {ENROLLMENT_DIR}")


for student_folder in sorted(VERIFICATION_DIR.iterdir()):
    if not student_folder.is_dir():
        continue

    expected_student = student_folder.name

    for path in sorted(student_folder.glob("*.jpg")):
        embedding, error = engine.get_live_embedding(path)

        if error:
            print(f"{path}: rejected — {error}")
            continue

        scores = {
            student_id: engine.similarity(template, embedding)
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
