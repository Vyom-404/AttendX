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

        return self.get_live_embedding_from_image(image)

    def get_live_embedding_from_image(self, image):
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

    def create_template_from_images(self, images, minimum_photos: int = 3):
        embeddings = []
        rejected = []

        for index, image in enumerate(images):
            embedding, error = self.get_live_embedding_from_image(image)
            if error:
                rejected.append({"index": index, "reason": error})
                continue
            embeddings.append(embedding)

        if len(embeddings) < minimum_photos:
            return (
                None,
                rejected,
                f"only {len(embeddings)} usable images; need {minimum_photos}",
            )

        template = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(template)
        if norm == 0:
            return None, rejected, "invalid enrollment template"

        return template / norm, rejected, None

    def verify_image(self, image, template):
        try:
            template = np.asarray(template, dtype=np.float32)
        except (TypeError, ValueError):
            return None, "invalid enrollment template values"

        if template.ndim != 1:
            return None, "invalid enrollment template shape"
        if not np.all(np.isfinite(template)):
            return None, "invalid enrollment template values"

        norm = np.linalg.norm(template)
        if norm == 0:
            return None, "invalid enrollment template"

        embedding, error = self.get_live_embedding_from_image(image)
        if error:
            return None, error
        if template.shape != embedding.shape:
            return None, "invalid enrollment template shape"

        return self.similarity(embedding, template / norm), None

    def make_template(
        self,
        student_id: str,
        folder: str | Path,
        minimum_photos: int = 3,
    ):
        folder = Path(folder)
        images = []
        paths = []

        for path in sorted(folder.glob("*.jpg")):
            image = cv2.imread(str(path))
            if image is None:
                print(f"Enrollment skipped {path}: could not read image")
                continue
            images.append(image)
            paths.append(path)

        template, rejected, error = self.create_template_from_images(
            images,
            minimum_photos=minimum_photos,
        )
        for item in rejected:
            print(f"Enrollment skipped {paths[item['index']]}: {item['reason']}")

        if error:
            raise ValueError(
                f"{student_id} enrollment failed: {error}"
            )
        return template

    @staticmethod
    def similarity(first_embedding, second_embedding) -> float:
        return float(np.dot(first_embedding, second_embedding))
