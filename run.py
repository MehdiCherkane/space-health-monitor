"""One-command offline launch for Astro Vital.

Serves the API and the *prebuilt* React/Vite bundle from one FastAPI process on loopback
(127.0.0.1:8000). The browser only talks to this process; nothing is fetched remotely at
runtime.

Preparation (do it while the network is available)::

    npm --prefix frontend ci
    npm --prefix frontend run build

Then, with the network disabled for the X01 rehearsal::

    python run.py --no-build

`python run.py` builds only when `frontend/dist/index.html` is missing. A failed or
unproductive build exits nonzero instead of serving a stale or absent bundle, and
`--no-build` with missing assets stops with the preparation command.
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
from backend.replay import CrewFixtureError, load_crew_fixture, verify_radlab_archive

FRONTEND_DIR = ROOT / "frontend"
FRONTEND_DIST = ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
PREPARE = "npm --prefix frontend ci && npm --prefix frontend run build"
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _tail(text: str | None, lines: int = 8) -> str:
    if not text:
        return ""
    return "\n".join(text.strip().splitlines()[-lines:])


def build_frontend() -> bool:
    """Run the production build once; return False on any failure, never raise."""
    print("Building frontend assets into frontend/dist ...")
    cmd = ["npm.cmd", "run", "build"] if sys.platform == "win32" else ["npm", "run", "build"]
    try:
        result = subprocess.run(cmd, cwd=FRONTEND_DIR, capture_output=True, text=True, check=True)
    except FileNotFoundError:
        print("npm was not found on PATH; install Node.js and retry.", file=sys.stderr)
        return False
    except subprocess.CalledProcessError as error:
        print(f"Frontend build failed (exit code {error.returncode}).", file=sys.stderr)
        output = _tail(error.stdout) or _tail(error.stderr)
        if output:
            print(output, file=sys.stderr)
        return False
    print("Frontend build complete.")
    return True


def ensure_assets(no_build: bool, force_build: bool) -> int | None:
    """Return None when a built bundle is ready, else the process exit code."""
    if no_build:
        if not FRONTEND_INDEX.is_file():
            print(
                f"--no-build requires an existing frontend bundle; missing {FRONTEND_INDEX}",
                file=sys.stderr,
            )
            print(f"Prepare the production bundle first: {PREPARE}", file=sys.stderr)
            print("Then relaunch with --no-build.", file=sys.stderr)
            return 1
        return None

    if force_build or not FRONTEND_INDEX.is_file():
        if not build_frontend():
            print(
                "Frontend build failed; refusing to start the server on stale or missing assets.",
                file=sys.stderr,
            )
            print(f"Prepare the production bundle first: {PREPARE}", file=sys.stderr)
            return 1
        if not FRONTEND_INDEX.is_file():
            print(
                f"Build reported success but {FRONTEND_INDEX} is still missing; "
                "refusing to advertise a ready application.",
                file=sys.stderr,
            )
            print(f"Check the Vite build output and retry: {PREPARE}", file=sys.stderr)
            return 1
    return None


def archive_report() -> int:
    """`--check-archive`: print A01. Exit 0 only on a verified archive, 2 when Blocked."""
    report = verify_radlab_archive()
    print(f"RadLab archive (A01): {report['status']}")
    print(f"Path: {report['path']}")
    if report["status"] == "Pass":
        print(
            f"Records: DosTel1={report.get('dostel1_count')} "
            f"DosTel2={report.get('dostel2_count')}"
        )
        print(f"SHA-256: {report['observed_sha256']}")
        return 0
    print(f"Reason: {report.get('reason', 'archive not verified')}")
    print(f"Expected SHA-256: {report['expected_sha256']}")
    if report.get("observed_sha256"):
        print(f"Observed SHA-256: {report['observed_sha256']}")
    if Path(report["path"]).exists():
        print("RadLab scenario unavailable: fix or remove the invalid archive before launching.")
    else:
        print("A02-A04 stay Blocked; the missing archive selects the labeled fixture preview.")
    return 2


def banner(host: str, port: int, crew_rows: int, archive_status: str) -> str:
    crew = (
        f"Loaded - {crew_rows} synthetic rows (integrated behavior)"
        if crew_rows
        else "Missing - fixture preview only"
    )
    archive = (
        "Pass - documented replay archive present"
        if archive_status == "Pass"
        else "Blocked - fixture preview only (python run.py --check-archive)"
    )
    return "\n".join(
        [
            "=" * 74,
            "  ASTRO VITAL - OFFLINE REPLAY PROTOTYPE",
            f"  Loopback URL   : http://{host}:{port}",
            f"  Frontend bundle: {FRONTEND_DIST} (prebuilt, served by this process)",
            f"  Crew fixture   : {crew}",
            f"  RadLab archive : {archive}",
            "  X01 rehearsal  : Not run - this banner is not evidence. Disable the network,",
            "                   follow acceptance/manual-checklist.md, and record the",
            "                   observed browser result before claiming X01.",
            "=" * 74,
        ]
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Start the Astro Vital offline demo")
    parser.add_argument("--host", default="127.0.0.1", help="Loopback host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Loopback port (default: 8000)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--build", action="store_true", help="Force a frontend rebuild before starting")
    mode.add_argument(
        "--no-build", action="store_true", help="Never build; require existing built assets"
    )
    parser.add_argument(
        "--check-archive", action="store_true", help="Report RadLab archive status (A01) and exit"
    )
    args = parser.parse_args(argv)

    if args.check_archive:
        return archive_report()

    if args.host not in LOOPBACK_HOSTS:
        print(
            f"Refusing to serve on {args.host!r}: this demo is loopback-only. "
            f"Use one of {sorted(LOOPBACK_HOSTS)}.",
            file=sys.stderr,
        )
        return 2

    exit_code = ensure_assets(no_build=args.no_build, force_build=args.build)
    if exit_code is not None:
        return exit_code

    archive = verify_radlab_archive()
    if archive["status"] != "Pass" and Path(archive["path"]).exists():
        print(
            f"RadLab archive at {archive['path']} is invalid: {archive.get('reason', 'verification failed')}",
            file=sys.stderr,
        )
        print("Fix or remove the invalid archive before launching.", file=sys.stderr)
        return 1
    try:
        crew_rows = len(load_crew_fixture() or [])
    except CrewFixtureError as error:
        print(f"Crew fixture is invalid: {error}", file=sys.stderr)
        print("Fix or remove fixtures/crew/sleep-vigilance.json before launching.", file=sys.stderr)
        return 1

    print(banner(args.host, args.port, crew_rows, archive["status"]))
    app = create_app()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
