import json
from typing import Annotated

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from face_service.face_engine import FaceEngine

MODEL_NAME = "buffalo_l"
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_ENROLLMENT_FILES = 10
MIN_ENROLLMENT_FILES = 3
MAX_IMAGE_PIXELS = 12_000_000

app = FastAPI(title="AttendX Face Service")
engine = FaceEngine()


def decode_image(contents: bytes):
    image = cv2.imdecode(np.frombuffer(contents, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="Invalid or unsupported image")

    height, width = image.shape[:2]
    if height * width > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="Image dimensions are too large")

    return image


async def read_image(file: UploadFile):
    if file.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG or PNG image")

    contents = await file.read(MAX_FILE_BYTES + 1)
    if len(contents) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Image file is too large")

    return decode_image(contents)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "liveness_enabled": True,
    }


@app.post("/v1/enrollment-template")
async def create_enrollment_template(
    files: Annotated[list[UploadFile], File()],
):
    if not MIN_ENROLLMENT_FILES <= len(files) <= MAX_ENROLLMENT_FILES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Upload between {MIN_ENROLLMENT_FILES} and "
                f"{MAX_ENROLLMENT_FILES} images"
            ),
        )

    images = []
    filenames = []
    for file in files:
        images.append(await read_image(file))
        filenames.append(file.filename or "unnamed image")

    template, rejected, error = engine.create_template_from_images(
        images,
        minimum_photos=MIN_ENROLLMENT_FILES,
    )
    if error:
        rejection_details = [
            {
                "filename": filenames[item["index"]],
                "reason": item["reason"],
            }
            for item in rejected
        ]
        raise HTTPException(
            status_code=422,
            detail={"message": error, "rejected_images": rejection_details},
        )

    return {
        "template": template.tolist(),
        "model": MODEL_NAME,
        "accepted_images": len(images) - len(rejected),
        "rejected_images": [
            {
                "filename": filenames[item["index"]],
                "reason": item["reason"],
            }
            for item in rejected
        ],
    }


@app.post("/v1/verify")
async def verify_capture(
    file: Annotated[UploadFile, File()],
    template_json: Annotated[str, Form()],
):
    try:
        template = json.loads(template_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Invalid template JSON") from exc

    if not isinstance(template, list) or not template:
        raise HTTPException(status_code=422, detail="Invalid enrollment template")

    image = await read_image(file)
    similarity, error = engine.verify_image(image, template)
    if error:
        return {
            "status": "rejected",
            "reason": error,
            "model": MODEL_NAME,
        }

    return {
        "status": "liveness_passed",
        "similarity": similarity,
        "model": MODEL_NAME,
    }
