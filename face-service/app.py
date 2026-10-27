"""Vercel entrypoint for the AttendX FastAPI face service."""

# Vercel's Python bundler omits `.pyi` typing stubs from vendored dependencies.
# scikit-image's lazy loader parses these stubs at import time, even though
# InsightFace only needs the `transform` submodule and its runtime exports.
import lazy_loader

_attach_stub = lazy_loader.attach_stub


def _attach_stub_without_skimage_typing_files(package_name, filename):
    try:
        return _attach_stub(package_name, filename)
    except ValueError as error:
        if not package_name.startswith("skimage") or "non-existent stub" not in str(error):
            raise

        submodules = ["transform"] if package_name == "skimage" else []
        submod_attrs = (
            {"_geometric": ["SimilarityTransform"]}
            if package_name == "skimage.transform"
            else None
        )
        return lazy_loader.attach(
            package_name,
            submodules=submodules,
            submod_attrs=submod_attrs,
        )


lazy_loader.attach_stub = _attach_stub_without_skimage_typing_files

from face_service.api import app

