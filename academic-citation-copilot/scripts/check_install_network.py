#!/usr/bin/env python3
"""Check whether this shell can reach the package registries used by local setup.

This script uses only Python's standard library so it can run before project
packages are installed. It is intended to distinguish repository setup issues
from external network/proxy blocks.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

CHECKS = (
    ("PyPI", "https://pypi.org/simple/fastapi/"),
    ("npm", "https://registry.npmjs.org/react"),
)

PROXY_ENV_KEYS = (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "http_proxy",
    "https_proxy",
    "npm_config_http_proxy",
    "npm_config_https_proxy",
)


def check_url(label: str, url: str) -> bool:
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "academic-citation-copilot-setup-check"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            status = response.status
    except urllib.error.HTTPError as exc:
        print(f"[FAIL] {label}: HTTP {exc.code} for {url}")
        return False
    except urllib.error.URLError as exc:
        print(f"[FAIL] {label}: {exc.reason} for {url}")
        return False
    except TimeoutError:
        print(f"[FAIL] {label}: timed out for {url}")
        return False

    if 200 <= status < 400:
        print(f"[OK] {label}: reachable ({status})")
        return True

    print(f"[FAIL] {label}: unexpected HTTP {status} for {url}")
    return False


def main() -> int:
    print("Checking package registry reachability...\n")
    configured_proxy = {key: os.environ[key] for key in PROXY_ENV_KEYS if key in os.environ}
    if configured_proxy:
        print("Proxy-related environment variables detected:")
        for key, value in configured_proxy.items():
            print(f"  {key}={value}")
        print()

    results = [check_url(label, url) for label, url in CHECKS]
    if all(results):
        print("\nPackage registries are reachable. If installs still fail, inspect lockfiles and package versions.")
        return 0

    print(
        "\nAt least one registry is unreachable from this shell. "
        "Commands such as `pip install -r backend/requirements.txt` and `npm install` "
        "will fail until the environment allows outbound access to PyPI and npm or provides an approved mirror."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
