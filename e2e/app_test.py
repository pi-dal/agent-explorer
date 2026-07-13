#!/usr/bin/env python3
"""Browser smoke and end-to-end checks for the production web bundle."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "src" / "fixtures" / "xiaoba-session.sample.jsonl"
FIXTURE_DIR = ROOT / "src" / "fixtures"
DEFAULT_URL = "http://127.0.0.1:4173"


def start_preview() -> tuple[subprocess.Popen[str] | None, str]:
    url = os.environ.get("E2E_BASE_URL", DEFAULT_URL).rstrip("/")
    if os.environ.get("E2E_BASE_URL"):
        return None, url

    command = "pnpm.cmd" if os.name == "nt" else "pnpm"
    server = subprocess.Popen(
        [command, "preview", "--host", "127.0.0.1", "--port", "4173"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if server.poll() is not None:
            output = server.stdout.read() if server.stdout else ""
            raise RuntimeError(f"Preview server exited early:\n{output}")
        try:
            with urllib.request.urlopen(url, timeout=1):
                return server, url
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.2)
    server.terminate()
    output = server.stdout.read() if server.stdout else ""
    raise RuntimeError(f"Preview server did not become ready:\n{output}")


def stop_preview(server: subprocess.Popen[str] | None) -> None:
    if server is None or server.poll() is not None:
        return
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait(timeout=5)


def wait_for_session(page: Page) -> None:
    page.get_by_test_id("timeline-scroll").wait_for(state="visible")
    page.get_by_text(re.compile(r"Timeline · \d+ events")).wait_for(state="visible")


def assert_scroll_regions(page: Page) -> None:
    timeline = page.get_by_test_id("timeline-scroll")
    timeline_metrics = timeline.evaluate(
        "element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight })"
    )
    assert timeline_metrics["scrollHeight"] > timeline_metrics["clientHeight"], timeline_metrics
    timeline.evaluate("element => { element.scrollTop = element.scrollHeight; return element.scrollTop }")
    assert timeline.evaluate("element => element.scrollTop") > 0

    filter_scroll = page.get_by_test_id("xiaoba-filter-scroll")
    filter_metrics = filter_scroll.evaluate(
        "element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })"
    )
    assert filter_metrics["scrollWidth"] > filter_metrics["clientWidth"], filter_metrics
    filter_scroll.evaluate("element => { element.scrollLeft = element.scrollWidth; return element.scrollLeft }")
    assert filter_scroll.evaluate("element => element.scrollLeft") > 0


def load_sample(page: Page) -> None:
    page.get_by_role("button", name="XiaoBa Sample", exact=True).click()
    wait_for_session(page)
    page.get_by_text("Prompt trace", exact=True).first.wait_for(state="visible")
    page.get_by_text(re.compile(r"Execution flow · \d+ items")).wait_for(state="visible")


def run_smoke(page: Page, url: str) -> None:
    page.goto(url, wait_until="networkidle")
    assert page.title() == "Agent Explorer"
    assert page.get_by_text("No session loaded", exact=True).count() > 0
    load_sample(page)


def run_e2e(page: Page, url: str) -> None:
    page.set_viewport_size({"width": 1024, "height": 480})
    page.goto(url, wait_until="networkidle")
    page.get_by_test_id("open-file-input").set_input_files(str(FIXTURE))
    wait_for_session(page)
    page.get_by_role("banner").get_by_text(
        "xiaoba-session.sample.jsonl", exact=True
    ).wait_for(state="visible")

    timeline_tool = page.get_by_role("option").filter(has_text=re.compile(r"read_file")).first
    timeline_tool.wait_for(state="visible")
    timeline_tool.click()

    tool_call = page.get_by_role("button", name=re.compile(r"Call · read_file")).first
    tool_call.wait_for(state="visible")
    tool_call.click()
    page.get_by_role("button", name="Execution", exact=True).click()
    page.get_by_text("Tool activity", exact=True).wait_for(state="visible")
    page.get_by_text("read_file", exact=True).first.wait_for(state="visible")

    page.get_by_test_id("open-folder-input").set_input_files(str(FIXTURE_DIR))
    page.get_by_role("button", name="Browse workspace logs").wait_for(state="visible")
    page.get_by_role("button", name="Browse workspace logs").click()
    tree = page.get_by_test_id("workspace-browser-tree")
    tree.wait_for(state="visible")
    assert tree.locator("button").count() >= 3

    assert_scroll_regions(page)


def run_suite(suite: str) -> None:
    server, url = start_preview()
    page: Page | None = None
    console_errors: list[str] = []
    page_errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            try:
                if suite == "smoke":
                    run_smoke(page, url)
                else:
                    run_e2e(page, url)
            except Exception:
                screenshot_dir = ROOT / "test-results"
                screenshot_dir.mkdir(exist_ok=True)
                page.screenshot(path=str(screenshot_dir / f"{suite}-failure.png"), full_page=True)
                raise
            finally:
                browser.close()
    finally:
        stop_preview(server)

    if console_errors or page_errors:
        details = "\n".join([*console_errors, *page_errors])
        raise RuntimeError(f"Browser errors detected:\n{details}")

    print(f"PASS {suite}: production app loaded and interaction checks completed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=("smoke", "e2e", "all"), default="all")
    args = parser.parse_args()
    suites = ("smoke", "e2e") if args.suite == "all" else (args.suite,)
    for suite in suites:
        run_suite(suite)


if __name__ == "__main__":
    main()
