import cv2
from insightface.app import FaceAnalysis

app = FaceAnalysis(
    name="buffalo_l",
    addons=["liveness"],
    liveness_mode="observe",
)
app.prepare(ctx_id=0, det_size=(640, 640))

for path in [
    "samples/reference.jpg",
    "samples/same_person.jpg",
    "samples/other_person.jpg",
    "samples/screen_replay.jpg",
]:
    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"Could not read image: {path}")

    faces = app.get(image)
    if len(faces) != 1:
        print(f"{path}: expected one face; found {len(faces)}")
        continue

    result = faces[0].liveness
    print(
        f"{path}: status={result.status}, "
        f"is_live={result.is_live}, score={result.live_score}"
    )