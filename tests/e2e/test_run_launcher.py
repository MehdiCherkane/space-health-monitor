"""Launcher failure paths (HZ-R3).

`run.py` must never advertise a ready application without a real built bundle, and a
failed or unproductive build must exit nonzero. These tests stub the build process and
uvicorn so no server is started.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import run  # noqa: E402
from backend.replay import CrewFixtureError  # noqa: E402


@pytest.fixture()
def paths(tmp_path, monkeypatch):
    """Point the launcher at a temporary frontend tree."""
    frontend = tmp_path / "frontend"
    dist = frontend / "dist"
    dist.mkdir(parents=True)
    index = dist / "index.html"
    monkeypatch.setattr(run, "FRONTEND_DIR", frontend)
    monkeypatch.setattr(run, "FRONTEND_DIST", dist)
    monkeypatch.setattr(run, "FRONTEND_INDEX", index)
    return index


@pytest.fixture()
def started(monkeypatch):
    """Capture uvicorn calls instead of starting a server."""
    calls: list[dict] = []
    monkeypatch.setattr(run, "create_app", lambda: object())
    monkeypatch.setattr(
        run.uvicorn, "run", lambda app, **kwargs: calls.append(kwargs)
    )
    return calls


def test_default_launch_refuses_when_the_required_build_fails(paths, started, monkeypatch, capsys):
    monkeypatch.setattr(run, "build_frontend", lambda: False)

    assert run.main([]) == 1
    assert started == []
    err = capsys.readouterr().err
    assert "Frontend build failed" in err
    assert run.PREPARE in err


def test_requested_build_failure_does_not_serve_a_stale_bundle(paths, started, monkeypatch, capsys):
    paths.write_text("<!doctype html><title>stale</title>", encoding="utf-8")
    monkeypatch.setattr(run, "build_frontend", lambda: False)

    assert run.main(["--build"]) == 1
    assert started == []
    assert "refusing to start the server" in capsys.readouterr().err


def test_build_that_produces_no_index_is_not_a_ready_application(paths, started, monkeypatch, capsys):
    monkeypatch.setattr(run, "build_frontend", lambda: True)

    assert run.main([]) == 1
    assert started == []
    err = capsys.readouterr().err
    assert "still missing" in err
    assert "ready application" in err


def test_no_build_with_missing_assets_prints_the_preparation_recipe(
    paths, started, monkeypatch, capsys
):
    def fail_if_called():
        raise AssertionError("--no-build must not run a build")

    monkeypatch.setattr(run, "build_frontend", fail_if_called)

    assert run.main(["--no-build"]) == 1
    assert started == []
    err = capsys.readouterr().err
    assert "--no-build requires an existing frontend bundle" in err
    assert run.PREPARE in err


def test_launch_requires_assets_and_never_claims_offline_evidence(paths, started, monkeypatch, capsys):
    def fake_build() -> bool:
        paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")
        return True

    monkeypatch.setattr(run, "build_frontend", fake_build)

    assert run.main([]) == 0
    assert started == [{"host": "127.0.0.1", "port": 8000, "log_level": "info"}]
    out = capsys.readouterr().out
    assert "X01 rehearsal  : Not run" in out
    assert "Offline-ready" not in out
    assert "Offline ready" not in out


def test_no_build_starts_with_a_ready_bundle(paths, started, monkeypatch):
    paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")

    def fail_if_called():
        raise AssertionError("existing assets must not trigger a rebuild")

    monkeypatch.setattr(run, "build_frontend", fail_if_called)

    assert run.main(["--no-build"]) == 0
    assert len(started) == 1


def test_forced_build_runs_and_then_serves(paths, started, monkeypatch):
    calls: list[str] = []

    def fake_build() -> bool:
        calls.append("build")
        paths.write_text("<!doctype html><title>rebuilt</title>", encoding="utf-8")
        return True

    monkeypatch.setattr(run, "build_frontend", fake_build)

    assert run.main(["--build"]) == 0
    assert calls == ["build"]
    assert len(started) == 1


def test_non_loopback_host_is_refused(paths, started, capsys):
    paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")

    assert run.main(["--host", "0.0.0.0", "--no-build"]) == 2
    assert started == []
    assert "loopback-only" in capsys.readouterr().err


def test_check_archive_reports_blocked_and_exits_nonzero(paths, started, monkeypatch, capsys):
    # Independent of whether this checkout happens to contain the pinned archive.
    monkeypatch.setattr(
        run,
        "verify_radlab_archive",
        lambda *args, **kwargs: {
            "status": "Blocked",
            "check": "A01",
            "path": "fixtures/radlab/missing.csv",
            "reason": "RadLab CSV archive not found",
            "expected_sha256": "0" * 64,
            "observed_sha256": None,
        },
    )
    assert run.main(["--check-archive"]) == 2
    assert started == []
    out = capsys.readouterr().out
    assert "RadLab archive (A01): Blocked" in out
    assert "A02-A04" in out


def test_check_archive_passes_only_with_a_verified_archive(paths, started, monkeypatch, capsys):
    monkeypatch.setattr(
        run,
        "verify_radlab_archive",
        lambda *args, **kwargs: {
            "status": "Pass",
            "check": "A01",
            "path": "fixtures/radlab/verified.csv",
            "expected_sha256": "0" * 64,
            "observed_sha256": "0" * 64,
            "dostel1_count": 84,
            "dostel2_count": 96,
        },
    )
    assert run.main(["--check-archive"]) == 0
    assert started == []
    out = capsys.readouterr().out
    assert "RadLab archive (A01): Pass" in out
    assert "DosTel1=84" in out


def test_invalid_crew_fixture_stops_the_launcher(paths, started, monkeypatch, capsys):
    paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")

    def broken():
        raise CrewFixtureError("Crew fixture scenario_id must be 'sleep_vigilance'")

    monkeypatch.setattr(run, "load_crew_fixture", broken)

    assert run.main(["--no-build"]) == 1
    assert started == []
    err = capsys.readouterr().err
    assert "Crew fixture is invalid" in err


@pytest.mark.parametrize(('argv', 'exit_code'), [(['--no-build'], 1), (['--check-archive'], 2)])
def test_invalid_archive_never_promises_preview(
    paths, started, monkeypatch, capsys, tmp_path, argv, exit_code
):
    paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")
    archive = tmp_path / "invalid.csv"
    archive.write_text("corrupted archive\n", encoding="utf-8")
    monkeypatch.setenv("ASTRO_VITAL_RADLAB_CSV", str(archive))

    assert run.main(argv) == exit_code
    assert started == []
    captured = capsys.readouterr()
    output = captured.out + captured.err
    assert str(archive) in output
    assert "hash mismatch" in output
    assert "Fix or remove" in output or "fix or remove" in output
    assert "fixture preview only" not in output
    assert "only the labeled preview" not in output


def test_missing_archive_still_launches_with_explicit_preview(
    paths, started, monkeypatch, capsys, tmp_path
):
    paths.write_text("<!doctype html><title>built</title>", encoding="utf-8")
    monkeypatch.setenv("ASTRO_VITAL_RADLAB_CSV", str(tmp_path / "absent.csv"))

    assert run.main(['--no-build']) == 0
    assert len(started) == 1
    assert "RadLab archive : Blocked - fixture preview only" in capsys.readouterr().out
