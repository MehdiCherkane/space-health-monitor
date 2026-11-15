"""Exercise the built HTML entry point against the real seeded API.

Build first, then run with Playwright installed and Chrome available:
uv run --python python3.12 --with-requirements backend/requirements.txt --with playwright \
    python -m pytest tests/browser -q

ASTRO_BROWSER_CHANNEL selects another installed Playwright browser channel.
This is local browser verification, not a Wi-Fi-off acceptance claim.
"""

import os
from pathlib import Path
import socket
import threading
import time

import pytest
import uvicorn

playwright = pytest.importorskip('playwright.sync_api')

from backend.api.main import create_app

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture()
def server_url(tmp_path, request):
    assert (ROOT / 'frontend/dist/index.html').is_file(), 'Run npm --prefix frontend run build first'
    app = create_app(
        tmp_path / 'browser.db',
        resources={'local_reaction_task': getattr(request, 'param', True)},
        crew_fixture_path=ROOT / 'fixtures/crew/sleep-vigilance.json',
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level='error'))
    thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 10
        while not server.started:
            assert thread.is_alive() and time.monotonic() < deadline, 'Local API failed to start'
            time.sleep(.01)
        yield f'http://127.0.0.1:{port}'
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


@pytest.fixture()
def page(server_url):
    with playwright.sync_playwright() as runtime:
        browser = runtime.chromium.launch(
            headless=True, channel=os.environ.get('ASTRO_BROWSER_CHANNEL', 'chrome'),
        )
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(server_url, wait_until='networkidle')
            page.get_by_role('button', name='Sleep and vigilance', exact=False).click()
            page.get_by_role('heading', name='Vigilance data missing', exact=True).wait_for()
            yield page
            assert errors == [], f'Browser errors: {errors}'
        finally:
            context.close()
            browser.close()


def test_repeated_checkpoint_finishes_and_playback_can_continue(page):
    pending = []
    page.route('**/api/v1/runs/**/state?*', lambda route: pending.append(route))
    checkpoint = page.get_by_role('button', name='09:01', exact=True)
    checkpoint.click()
    checkpoint.click()
    assert len(pending) == 1
    pending[0].continue_()
    page.get_by_role('heading', name='Sleep and vigilance change', exact=True).wait_for()
    page.unroute('**/api/v1/runs/**/state?*')
    page.get_by_role('button', name='Play replay', exact=True).click()
    playwright.expect(page.locator('.astro-clock time')).to_have_attribute(
        'datetime', '2026-01-10T09:02:00Z', timeout=5000,
    )
    page.get_by_role('button', name='Pause replay', exact=True).click()


def test_reaction_callout_starts_only_an_available_task(page):
    callout = page.get_by_role('button', name='02 Reaction check', exact=False)
    playwright.expect(callout).to_be_enabled()
    callout.click()
    page.get_by_role('button', name='Start practice', exact=True).wait_for()
    page.get_by_role('button', name='Cancel reaction check', exact=True).click()
    page.get_by_role('button', name='09:01', exact=True).click()
    page.get_by_role('heading', name='Sleep and vigilance change', exact=True).wait_for()
    playwright.expect(callout).to_be_disabled()
    playwright.expect(page.get_by_text('No reaction check is offered for this time.', exact=True)).to_be_visible()
    assert page.locator('.crew-checkin__reaction-task').count() == 0


@pytest.mark.parametrize('server_url', [False], indirect=True)
def test_disabled_reaction_callout_explains_and_routes_fallback(page):
    callout = page.get_by_role('button', name='02 Reaction check', exact=False)
    playwright.expect(callout).to_be_disabled()
    explanation = page.locator('#' + callout.get_attribute('aria-describedby'))
    playwright.expect(explanation).to_have_text('Reaction check unavailable')
    hero = page.locator('.astro-hero')
    hero.get_by_role('button', name='Review available inputs', exact=True).click()
    playwright.expect(page.get_by_role('dialog')).to_be_visible()
    assert page.locator('.crew-checkin__reaction-task').count() == 0


def test_fresh_run_cancels_the_actual_entry_point_task(page):
    page.get_by_role('button', name='02 Reaction check', exact=False).click()
    page.get_by_role('button', name='Start practice', exact=True).wait_for()
    page.get_by_role('button', name='Fresh run', exact=True).click()
    page.get_by_role('heading', name='Vigilance data missing', exact=True).wait_for()
    assert page.locator('.crew-checkin__reaction-task').count() == 0
    playwright.expect(page.get_by_role('button', name='02 Reaction check', exact=False)).to_be_enabled()
