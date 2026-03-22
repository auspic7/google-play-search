from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google_play_scraper import search, app as app_details
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import uvicorn

app = FastAPI(title="Google Play Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=10)


def _fetch_details(app_item: dict, lang: str, country: str) -> dict:
    """Fetch full app details."""
    try:
        d = app_details(app_item['appId'], lang=lang, country=country)

        # Release date
        released = d.get('released')
        if released:
            try:
                if '.' in released and released[0].isdigit():
                    parts = released.replace('.', '').strip().split()
                    if len(parts) == 3:
                        app_item['release_date'] = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                    else:
                        app_item['release_date'] = released
                else:
                    parsed = datetime.strptime(released, '%b %d, %Y')
                    app_item['release_date'] = parsed.strftime('%Y-%m-%d')
            except Exception:
                app_item['release_date'] = released
        else:
            app_item['release_date'] = 'N/A'

        # Update date
        updated = d.get('updated')
        if updated:
            app_item['update_date'] = datetime.fromtimestamp(updated).strftime('%Y-%m-%d')
        else:
            app_item['update_date'] = 'N/A'

        # All available detail fields
        app_item['free'] = d.get('free', True)
        app_item['price'] = d.get('price', 0)
        app_item['currency'] = d.get('currency', 'USD')
        app_item['genre'] = d.get('genre', 'Unknown')
        app_item['genreId'] = d.get('genreId', '')
        app_item['description'] = (d.get('description') or '')[:500]
        app_item['summary'] = d.get('summary', '')
        app_item['contentRating'] = d.get('contentRating', '')
        app_item['adSupported'] = d.get('adSupported', False)
        app_item['containsAds'] = d.get('containsAds', False)
        app_item['reviews'] = d.get('reviews', 0)
        app_item['ratings'] = d.get('ratings', 0)
        app_item['histogram'] = d.get('histogram', [0, 0, 0, 0, 0])
        app_item['version'] = d.get('version', 'N/A')
        app_item['androidVersion'] = d.get('androidVersion', 'N/A')
        app_item['minInstalls'] = d.get('minInstalls', 0)
        app_item['maxInstalls'] = d.get('maxInstalls', 0)
        app_item['realInstalls'] = d.get('realInstalls', 0)
        app_item['developerEmail'] = d.get('developerEmail', '')
        app_item['developerWebsite'] = d.get('developerWebsite', '')
        app_item['developerAddress'] = d.get('developerAddress', '')
        app_item['developerId'] = d.get('developerId', '')
        app_item['privacyPolicy'] = d.get('privacyPolicy', '')
        app_item['headerImage'] = d.get('headerImage', '')
        app_item['screenshots'] = d.get('screenshots', [])[:5]
        app_item['recentChanges'] = d.get('recentChanges', '')
        app_item['sale'] = d.get('sale', False)
        app_item['saleText'] = d.get('saleText', '')
        app_item['originalPrice'] = d.get('originalPrice', 0)
        app_item['inAppProductPrice'] = d.get('inAppProductPrice', '')
    except Exception:
        app_item['release_date'] = app_item.get('release_date', 'N/A')
        app_item['update_date'] = app_item.get('update_date', 'N/A')

    return app_item


def _build_developer_stats(apps_list: list) -> dict:
    total_installs = 0
    scores = []
    genres = {}
    free_count = 0
    paid_count = 0

    for a in apps_list:
        installs_str = str(a.get('realInstalls') or a.get('installs', '0')).replace(',', '').replace('+', '')
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
    query: str = Query(...),
    search_type: str = Query("Keyword"),
    lang: str = Query("ko"),
    country: str = Query("kr"),
    limit: int = Query(20, ge=1, le=50),
):
    try:
        if search_type == "Developer ID":
            search_query = f'pub:"{query}"'
        else:
            search_query = query

        apps = search(search_query, n_hits=limit, lang=lang, country=country)

        futures = {executor.submit(_fetch_details, a, lang, country): a for a in apps}
        done = []
        processed_items = set()
        for future in as_completed(futures, timeout=10):
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
            key=lambda x: int(str(x.get('realInstalls') or x.get('installs', '0')).replace(',', '').replace('+', '') or 0),
            reverse=True,
        )

        result = {
            "success": True,
            "count": len(done),
            "apps": done,
        }

        if search_type == "Developer ID":
            result["developer_stats"] = _build_developer_stats(done)

        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
