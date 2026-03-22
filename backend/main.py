import os
from fastapi import FastAPI, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from google_play_scraper import search, app as app_details
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
import uvicorn
import json
import urllib.request

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

app = FastAPI(title="Google Play Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=10)

# --- Rate Limiting (in-memory) ---
# Structure: { "ip:1.2.3.4": {"date": "2026-03-22", "count": 3}, "user:abc123": {...} }
rate_limit_store: dict = {}

ANON_DAILY_LIMIT = 5
AUTH_DAILY_LIMIT = 30


def _get_rate_key_and_limit(request: Request, user_id: Optional[str] = None):
    if user_id:
        return f"user:{user_id}", AUTH_DAILY_LIMIT
    ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
    return f"ip:{ip}", ANON_DAILY_LIMIT


def _check_rate_limit(key: str, limit: int):
    today = date.today().isoformat()
    entry = rate_limit_store.get(key)
    if not entry or entry["date"] != today:
        rate_limit_store[key] = {"date": today, "count": 0}
        entry = rate_limit_store[key]
    return entry["count"], limit


def _increment_rate(key: str):
    today = date.today().isoformat()
    entry = rate_limit_store.get(key)
    if not entry or entry["date"] != today:
        rate_limit_store[key] = {"date": today, "count": 0}
    rate_limit_store[key]["count"] += 1


# --- Google OAuth Token Verification ---
_google_certs_cache = {"certs": None, "fetched_at": None}


def _get_google_certs():
    now = datetime.now()
    if _google_certs_cache["certs"] and _google_certs_cache["fetched_at"]:
        diff = (now - _google_certs_cache["fetched_at"]).total_seconds()
        if diff < 3600:
            return _google_certs_cache["certs"]
    # Fetch fresh certs
    url = "https://www.googleapis.com/oauth2/v3/certs"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        certs = json.loads(resp.read())
    _google_certs_cache["certs"] = certs
    _google_certs_cache["fetched_at"] = now
    return certs


def _verify_google_token(token: str) -> Optional[dict]:
    """Verify Google ID token using Google's tokeninfo endpoint."""
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read())
        # Verify audience matches our client ID
        if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
            return None
        return {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "picture": payload.get("picture"),
        }
    except Exception:
        return None


def _extract_user_from_request(authorization: Optional[str] = None) -> Optional[dict]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if not token:
        return None
    return _verify_google_token(token)


# --- Endpoints ---

@app.get("/api/auth/verify")
def verify_auth(authorization: Optional[str] = Header(None)):
    user = _extract_user_from_request(authorization)
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}


@app.get("/api/rate-limit")
def get_rate_limit(request: Request, authorization: Optional[str] = Header(None)):
    user = _extract_user_from_request(authorization)
    user_id = user["sub"] if user else None
    key, limit = _get_rate_key_and_limit(request, user_id)
    used, total = _check_rate_limit(key, limit)
    return {
        "used": used,
        "limit": total,
        "remaining": total - used,
        "authenticated": user is not None,
    }


def _fetch_details(app_item: dict, lang: str, country: str) -> dict:
    """Fetch one app's details (runs in thread pool)."""
    try:
        details = app_details(app_item['appId'], lang=lang, country=country)

        released = details.get('released', None)
        if released:
            try:
                if '.' in released and released[0].isdigit():
                    date_parts = released.replace('.', '').strip().split()
                    if len(date_parts) == 3:
                        app_item['release_date'] = f"{date_parts[0]}-{date_parts[1].zfill(2)}-{date_parts[2].zfill(2)}"
                    else:
                        app_item['release_date'] = released
                else:
                    parsed = datetime.strptime(released, '%b %d, %Y')
                    app_item['release_date'] = parsed.strftime('%Y-%m-%d')
            except Exception:
                app_item['release_date'] = released
        else:
            app_item['release_date'] = 'N/A'

        updated = details.get('updated', None)
        if updated:
            app_item['update_date'] = datetime.fromtimestamp(updated).strftime('%Y-%m-%d')
        else:
            app_item['update_date'] = 'N/A'

        app_item['free'] = details.get('free', True)
        app_item['genre'] = details.get('genre', 'Unknown')
    except Exception:
        app_item['release_date'] = 'N/A'
        app_item['update_date'] = 'N/A'

    return app_item


def _build_developer_stats(apps_list: list) -> dict:
    """Build developer statistics from app list."""
    total_installs = 0
    scores = []
    genres = {}
    free_count = 0
    paid_count = 0

    for a in apps_list:
        installs_str = str(a.get('installs', '0')).replace(',', '').replace('+', '')
        try:
            total_installs += int(installs_str)
        except ValueError:
            pass

        score = a.get('score')
        if score:
            scores.append(float(score))

        genre = a.get('genre', 'Unknown')
        genres[genre] = genres.get(genre, 0) + 1

        if a.get('free', True):
            free_count += 1
        else:
            paid_count += 1

    return {
        "total_apps": len(apps_list),
        "total_installs": total_installs,
        "avg_rating": sum(scores) / len(scores) if scores else None,
        "free_count": free_count,
        "paid_count": paid_count,
        "genres": genres,
    }


@app.get("/api/search")
def search_apps(
    request: Request,
    query: str = Query(...),
    search_type: str = Query("Keyword"),
    lang: str = Query("ko"),
    country: str = Query("kr"),
    limit: int = Query(20, ge=1, le=50),
    authorization: Optional[str] = Header(None),
):
    # Rate limit check
    user = _extract_user_from_request(authorization)
    user_id = user["sub"] if user else None
    key, rate_limit = _get_rate_key_and_limit(request, user_id)
    used, total = _check_rate_limit(key, rate_limit)

    if used >= total:
        return {
            "success": False,
            "error": "Daily search limit reached",
            "rate_limit": {"used": used, "limit": total, "remaining": 0, "authenticated": user is not None},
        }

    try:
        if search_type == "Developer ID":
            search_query = f'pub:"{query}"'
        else:
            search_query = query

        apps = search(search_query, n_hits=limit, lang=lang, country=country)

        # Parallel detail fetching (max 8s wall-clock)
        futures = {
            executor.submit(_fetch_details, a, lang, country): a
            for a in apps
        }
        done = []
        processed_items = set()
        for future in as_completed(futures, timeout=8):
            try:
                result = future.result()
                app_id = result.get('appId')
                if app_id not in processed_items:
                    processed_items.add(app_id)
                    done.append(result)
            except Exception:
                item = futures[future]
                app_id = item.get('appId')
                if app_id not in processed_items:
                    processed_items.add(app_id)
                    item['release_date'] = 'N/A'
                    item['update_date'] = 'N/A'
                    done.append(item)

        for future, item in futures.items():
            if not future.done():
                future.cancel()
                app_id = item.get('appId')
                if app_id not in processed_items:
                    processed_items.add(app_id)
                    item['release_date'] = 'N/A'
                    item['update_date'] = 'N/A'
                    done.append(item)

        done.sort(
            key=lambda x: int(
                str(x.get('installs', '0')).replace(',', '').replace('+', '') or 0
            ),
            reverse=True,
        )

        # Increment rate limit AFTER successful search
        _increment_rate(key)
        new_used = used + 1

        result = {
            "success": True,
            "count": len(done),
            "apps": done,
            "rate_limit": {"used": new_used, "limit": total, "remaining": total - new_used, "authenticated": user is not None},
        }

        if search_type == "Developer ID":
            result["developer_stats"] = _build_developer_stats(done)

        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
