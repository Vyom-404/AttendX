from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis


class FaceEngine:
    """Loads InsightFace once and provides enrollment/matching helpers."""

    def __init__(self):
        self.app = FaceAnalysis(
            name="buffalo_l",
            addons=["liveness"],
            liveness_mode="normal",
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))

    def get_live_embedding(self, path: str | Path):
        image = cv2.imread(str(path))
        if image is None:
            return None, "could not read image"

        faces = self.app.get(image)
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

    def make_template(
        self,
        student_id: str,
        folder: str | Path,
        minimum_photos: int = 3,
    ):
        folder = Path(folder)
        embeddings = []

        for path in sorted(folder.glob("*.jpg")):
            embedding, error = self.get_live_embedding(path)

            if error:
                print(f"Enrollment skipped {path}: {error}")
                continue

            embeddings.append(embedding)

        if len(embeddings) < minimum_photos:
            raise ValueError(
                f"{student_id} has only {len(embeddings)} usable enrollment photos"
            )

        template = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(template)

        if norm == 0:
            raise ValueError(f"{student_id} has an invalid enrollment template")

        return template / norm

    @staticmethod
    def similarity(first_embedding, second_embedding) -> float:
        return float(np.dot(first_embedding, second_embedding))
