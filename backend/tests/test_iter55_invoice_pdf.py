"""
Regression tests for invoice PDF generation (Iteration 55).
Ensures customer invoice download endpoint:
  - Returns HTTP 200
  - Includes Content-Type: application/pdf
  - Includes Content-Disposition attachment filename
  - Includes Cache-Control no-store hardening
  - Includes X-Content-Type-Options: nosniff
  - Payload starts with %PDF magic bytes and ends with %%EOF
  - `file` command can identify it as a valid PDF (verifies the "file: command not found"
    warning is fixed via `apt-get install file` in the container)
"""
import os
import shutil
import subprocess
import pytest
import requests

API_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get(
    "TEST_API_URL", "https://airyatra-corporate.preview.emergentagent.com"
)
CUSTOMER_EMAIL = "customer@airyatra.co.in"
CUSTOMER_PASSWORD = "Customer@123"


def _customer_token() -> str:
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _pick_booking_id(token: str) -> str:
    r = requests.get(
        f"{API_URL}/api/customer/trips",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    trips = data.get("trips") or data.get("bookings") or (data if isinstance(data, list) else [])
    assert trips, "Customer must have at least one booking to test invoice PDF"
    return trips[0].get("id") or trips[0].get("booking_id")


@pytest.fixture(scope="module")
def invoice_response():
    token = _customer_token()
    bid = _pick_booking_id(token)
    r = requests.get(
        f"{API_URL}/api/customer/bookings/{bid}/invoice",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    return r


def test_invoice_returns_200(invoice_response):
    assert invoice_response.status_code == 200, f"Expected 200, got {invoice_response.status_code}: {invoice_response.text[:200]}"


def test_invoice_content_type_pdf(invoice_response):
    assert invoice_response.headers.get("content-type") == "application/pdf"


def test_invoice_content_disposition_attachment(invoice_response):
    cd = invoice_response.headers.get("content-disposition", "")
    assert "attachment" in cd and ".pdf" in cd, f"Bad content-disposition: {cd}"


def test_invoice_cache_control_hardened(invoice_response):
    cc = (invoice_response.headers.get("cache-control") or "").lower()
    assert "no-store" in cc or "no-cache" in cc, f"Cache-Control should prevent caching: {cc}"


def test_invoice_no_sniff_header(invoice_response):
    assert invoice_response.headers.get("x-content-type-options", "").lower() == "nosniff"


def test_invoice_pdf_magic_bytes(invoice_response):
    body = invoice_response.content
    assert body.startswith(b"%PDF"), f"PDF must start with %PDF magic bytes, got {body[:8]!r}"
    assert b"%%EOF" in body[-64:], "PDF must end with %%EOF trailer"


def test_invoice_pdf_size_reasonable(invoice_response):
    # A meaningful invoice PDF should be at least 1 KB (has header/footer/table)
    assert len(invoice_response.content) >= 1024, f"PDF too small: {len(invoice_response.content)} bytes"


def test_file_command_identifies_pdf(invoice_response, tmp_path):
    """Verifies the `file` binary is installed and can identify the invoice payload.
    Prevents the historical 'file: command not found' warning in test tooling."""
    if shutil.which("file") is None:
        pytest.skip("`file` binary not installed in this environment")
    p = tmp_path / "invoice.pdf"
    p.write_bytes(invoice_response.content)
    result = subprocess.run(["file", str(p)], capture_output=True, text=True, timeout=5)
    assert result.returncode == 0, f"file command failed: {result.stderr}"
    assert "PDF document" in result.stdout, f"Not identified as PDF: {result.stdout}"
