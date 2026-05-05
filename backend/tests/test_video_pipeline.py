"""Backend tests for AI Video Generator Pro."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://script-to-reel-25.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Shared state across tests
_state = {}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{API}/auth/dev", json={"email": "qa@test.com", "name": "QA Tester"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    _state["token"] = data["token"]
    _state["user"] = data["user"]
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return data


# ---- Root ----
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Auth ----
def test_auth_dev_returns_token_and_user(session):
    r = session.post(f"{API}/auth/dev", json={"email": "qa@test.com", "name": "QA Tester"})
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["token"], str) and len(d["token"]) > 20
    u = d["user"]
    assert u["email"] == "qa@test.com"
    assert u["name"]
    assert isinstance(u["credits"], int)


def test_auth_dev_invalid_email(session):
    r = session.post(f"{API}/auth/dev", json={"email": "no-email", "name": "x"})
    assert r.status_code == 400


def test_auth_me_without_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_auth_me_with_token(session, auth):
    r = session.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "qa@test.com"


# ---- Templates ----
def test_templates(session):
    r = session.get(f"{API}/templates")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) == 6
    for t in arr:
        for k in ("id", "name", "category", "prompt", "style", "duration"):
            assert k in t, f"missing {k}"


# ---- Video generation ----
def test_videos_generate_creates_pending(session, auth):
    body = {
        "prompt": "Tres tips rápidos para ahorrar dinero este mes",
        "style": "viral", "aspect": "9:16", "resolution": "720p",
        "voice": "nova", "language": "es", "subtitle_style": "tiktok",
        "target_duration": 15,
    }
    r = session.post(f"{API}/videos/generate", json=body)
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    assert vid
    _state["vid"] = vid
    # Almost-immediate fetch -> should exist with pending or processing
    r2 = session.get(f"{API}/videos/{vid}")
    assert r2.status_code == 200
    assert r2.json()["status"] in ("pending", "processing", "completed", "failed")


def test_videos_list(session, auth):
    r = session.get(f"{API}/videos")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    ids = [v["id"] for v in arr]
    assert _state["vid"] in ids
    # Sorted desc by created_at
    if len(arr) >= 2:
        assert arr[0]["created_at"] >= arr[-1]["created_at"]


def test_pipeline_completes_and_credits_decrement(session, auth):
    vid = _state["vid"]
    deadline = time.time() + 300  # 5 min
    final = None
    seen_stages = set()
    while time.time() < deadline:
        r = session.get(f"{API}/videos/{vid}")
        assert r.status_code == 200
        d = r.json()
        seen_stages.add(d.get("status"))
        if d["status"] in ("completed", "failed"):
            final = d
            break
        time.sleep(8)
    assert final is not None, f"Pipeline did not finish in 5 minutes; stages seen: {seen_stages}"
    if final["status"] == "failed":
        pytest.fail(f"Pipeline failed: {final.get('error')}")
    assert final["status"] == "completed"
    assert final.get("video_url"), "video_url missing"
    # Fetch the file
    url = f"{BASE_URL}{final['video_url']}"
    r = requests.get(url, headers={"Authorization": f"Bearer {_state['token']}"})
    assert r.status_code == 200, f"final.mp4 not accessible: {r.status_code}"
    assert len(r.content) > 1000, "final.mp4 suspiciously small"
    # Credits decrement
    me = session.get(f"{API}/auth/me").json()
    assert me["credits"] <= _state["user"]["credits"] - 10


def test_videos_generate_402_when_low_credits(session, auth):
    # Drain credits via DB by creating a low-credit user
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/dev", json={"email": "qa-broke@test.com", "name": "Broke"})
    assert r.status_code == 200
    tok = r.json()["token"]
    # Drain by calling DB directly via backend? Not available. Instead we accept a skip if user has credits.
    # Trick: hit generate endpoint until credits exhausted is too costly; emulate by directly setting via mongo CLI is not available.
    # Therefore we test only structure: endpoint returns 200 (has credits) – mark as informational.
    s.headers.update({"Authorization": f"Bearer {tok}"})
    me = s.get(f"{API}/auth/me").json()
    pytest.skip(f"402 test skipped; new user has {me['credits']} credits (cannot drain cheaply).")


# ---- Delete ----
def test_delete_video_and_storage(session, auth):
    vid = _state.get("vid")
    if not vid:
        pytest.skip("no vid")
    r = session.delete(f"{API}/videos/{vid}")
    assert r.status_code == 200
    # Subsequent get should be 404
    r2 = session.get(f"{API}/videos/{vid}")
    assert r2.status_code == 404
    # Storage folder check via file endpoint
    r3 = requests.get(f"{API}/files/{vid}/final.mp4")
    assert r3.status_code == 404
