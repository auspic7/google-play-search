from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google_play_scraper import search, app as app_details
from datetime import datetime
import uvicorn

app = FastAPI(title="Google Play Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/search")
async def search_apps(
    query: str = Query(...),
    search_type: str = Query("Keyword"),
    lang: str = Query("ko"),
    country: str = Query("kr"),
):
    try:
        if search_type == "Developer ID":
            search_query = f'pub:"{query}"'
        else:
            search_query = query
        
        apps = search(search_query, n_hits=50, lang=lang, country=country)
        
        # 상세 정보 추가
        for app_item in apps:
            try:
                details = app_details(app_item['appId'], lang=lang, country=country)
                
                # released 날짜 처리
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
                    except:
                        app_item['release_date'] = released
                else:
                    app_item['release_date'] = 'N/A'
                
                # updated 날짜 처리
                updated = details.get('updated', None)
                if updated:
                    app_item['update_date'] = datetime.fromtimestamp(updated).strftime('%Y-%m-%d')
                else:
                    app_item['update_date'] = 'N/A'
            except:
                app_item['release_date'] = 'N/A'
                app_item['update_date'] = 'N/A'
        
        # installs 기준 정렬
        apps.sort(key=lambda x: int(x.get('installs', '0').replace(',', '').replace('+', '') or 0), reverse=True)
        
        return {"success": True, "count": len(apps), "apps": apps}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
