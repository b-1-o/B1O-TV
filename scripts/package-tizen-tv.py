#!/usr/bin/env python3
"""Create an unsigned WGT-shaped ZIP from Vite's dist directory for local signing."""
from __future__ import annotations

import argparse
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIZEN_NS = "http://tizen.org/ns/widgets"
EXPECTED_APP_ID = "B1Otv00001.B1web"
EXPECTED_PACKAGE_ID = "B1Otv00001"


def fail(message: str) -> "None":
    print(f"[TV package] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", default=str(ROOT / "dist"), help="Built Vite output directory (default: dist)")
    parser.add_argument("--output", default=str(ROOT / "release-tizen" / "B1O-TV-unsigned.wgt"), help="Output WGT path")
    args = parser.parse_args()

    dist = Path(args.dist).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not dist.is_dir():
        fail(f"Build output directory does not exist: {dist}")
    if output == dist or dist in output.parents:
        fail("Output must be outside dist/ so the WGT is not accidentally included in itself.")

    required = ("config.xml", "index.html", "icon.png")
    for name in required:
        path = dist / name
        if not path.is_file() or path.stat().st_size == 0:
            fail(f"Required file missing or empty: {path}")

    try:
        widget = ET.parse(dist / "config.xml").getroot()
    except ET.ParseError as error:
        fail(f"Invalid dist/config.xml: {error}")

    application = widget.find(f"{{{TIZEN_NS}}}application")
    if application is None:
        fail("dist/config.xml has no tizen:application element.")
    app_id = application.attrib.get("id")
    package_id = application.attrib.get("package")
    if app_id != EXPECTED_APP_ID or package_id != EXPECTED_PACKAGE_ID:
        fail(f"Unexpected app/package IDs: {app_id!r} / {package_id!r}. Refusing to package an unexpected manifest.")

    files = []
    for folder, dirnames, filenames in os.walk(dist, followlinks=False):
        folder_path = Path(folder)
        dirnames[:] = sorted(name for name in dirnames if not (folder_path / name).is_symlink())
        for filename in filenames:
            file_path = folder_path / filename
            if file_path.is_symlink():
                fail(f"Symbolic links are not allowed in the WGT: {file_path}")
            if not file_path.is_file():
                continue
            archive_name = file_path.relative_to(dist).as_posix()
            if archive_name.startswith("/") or ".." in Path(archive_name).parts:
                fail(f"Unsafe archive path: {archive_name}")
            files.append((archive_name, file_path))

    names = [name for name, _ in files]
    if len(names) != len(set(names)):
        fail("Duplicate paths found in build output.")
    if not files:
        fail("Build output contains no files.")

    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        if output.exists():
            output.unlink()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for archive_name, file_path in sorted(files, key=lambda item: (0 if item[0] == "config.xml" else 1, item[0])):
                archive.write(file_path, archive_name)
        with zipfile.ZipFile(output, "r") as archive:
            bad_member = archive.testzip()
            if bad_member:
                fail(f"Archive integrity check failed at {bad_member}.")
            archived = set(archive.namelist())
            for required_name in required:
                if required_name not in archived:
                    fail(f"Archive root is missing {required_name}.")
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        fail(f"Could not create/verify the WGT: {error}")

    print(f"[TV package] Created unsigned WGT: {output}")
    print(f"[TV package] Included {len(files)} files; size {output.stat().st_size:,} bytes.")
    print("[TV package] IMPORTANT: this archive has no Samsung signatures.")
    print("[TV package] Import it into a supported local signing flow (for example Apps2Samsung), or use Tizen Studio with your own profile.")
    print("[TV package] Do not install this unsigned file directly with raw SDB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
