import cv2
import numpy as np
from insightface.app import FaceAnalysis

app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0, det_size=(640, 640))


def get_embedding(path):
    image = cv2.imread(path)
    if image is None:
        raise ValueError(f"Could not read image: {path}")

    faces = app.get(image)
    if len(faces) != 1:
        raise ValueError(f"Expected one face in {path}; found {len(faces)}")

    embedding = faces[0].embedding
    return embedding / np.linalg.norm(embedding)


def similarity(first, second):
    return float(np.dot(first, second))


reference = get_embedding("samples/reference.jpg")
same_person = get_embedding("samples/same_person.jpg")
other_person = get_embedding("samples/other_person.jpg")

print(f"Same person similarity: {similarity(reference, same_person):.4f}")
print(f"Other person similarity: {similarity(reference, other_person):.4f}")