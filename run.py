"""One-command offline launch for Astro Vital (HZ-14, X01).

Builds the frontend once (if needed) and serves the API and static frontend assets
from the same FastAPI process on loopback (127.0.0.1:8000). All assets are local.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn
from backend.api.main import create_app
from backend.replay import verify_radlab_archive, load_crew_fixture


def build_frontend() -> bool:
    """Run frontend build to generate static bundle in frontend/dist."""
    frontend_dir = ROOT / "frontend"
    print("Building frontend assets in frontend/dist...")
    try:
        cmd = ["npm.cmd", "run", "build"] if sys.platform == "win32" else ["npm", "run", "build"]
        result = subprocess.run(cmd, cwd=frontend_dir, capture_output=True, text=True, check=True)
        print("Frontend build complete.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"Warning: Failed to build frontend: {exc}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Start Astro Vital offline local demo")
    parser.add_argument("--host", default="127.0.0.1", help="Loopback host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Loopback port (default: 8000)")
    parser.add_argument("--build", action="store_true", help="Force rebuild frontend assets before starting")
    parser.add_argument("--no-build", action="store_true", help="Skip rebuilding frontend even if missing")
    parser.add_argument("--check-archive", action="store_true", help="Audit RadLab archive status and exit")
    args = parser.parse_args()

    # Archive check CLI shortcut
    if args.check_archive:
        report = verify_radlab_archive()
        print(f"RadLab archive status: {report['status']}")
        print(f"Reason: {report.get('reason', 'OK')}")
        if report.get("observed_sha256"):
            print(f"Observed SHA-256: {report['observed_sha256']}")
        print(f"Expected SHA-256: {report['expected_sha256']}")
        sys.exit(0 if report["status"] == "Pass" else 2)

    frontend_dist = ROOT / "frontend" / "dist"
    if args.build or (not args.no_build and not (frontend_dist / "index.html").is_file()):
        build_frontend()

    radlab_status = verify_radlab_archive()["status"]
    crew_fixture_loaded = load_crew_fixture() is not None

    print("=" * 65)
    print("  ASTRO VITAL — OFFLINE REPLAY PROTOTYPE")
    print(f"  Loopback URL : http://{args.host}:{args.port}")
    print(f"  RadLab Archive : {radlab_status} ({'Ready' if radlab_status == 'Pass' else 'Preview stub fallback'})")
    print(f"  Crew Fixture   : {'Loaded (Integrated)' if crew_fixture_loaded else 'Missing (Preview stub fallback)'}")
    print("  Runtime Mode   : Loopback only · Offline-ready · No external CDN")
    print("=" * 65)

    app = create_app()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
