import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [searchType, setSearchType] = useState('Keyword')
  const [langCountry, setLangCountry] = useState('ko-KR')
  const [searchTerm, setSearchTerm] = useState('')
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('search')
  const [devStats, setDevStats] = useState(null)
  const [expandedApp, setExpandedApp] = useState(null)

  const [devFavorites, setDevFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gplay-dev-favorites') || '[]') } catch { return [] }
  })

  const langCountryMap = {
    'ko-KR': { lang: 'ko', country: 'kr', label: '🇰🇷 한국어' },
    'en-US': { lang: 'en', country: 'us', label: '🇺🇸 English' },
    'ja-JP': { lang: 'ja', country: 'jp', label: '🇯🇵 日本語' },
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('search_term')) {
      const st = params.get('search_type') || 'Keyword'
      const lc = params.get('lang_country') || 'ko-KR'
      setSearchType(st); setLangCountry(lc); setSearchTerm(params.get('search_term'))
      handleSearch(params.get('search_term'), st, lc)
    }
  }, [])

  useEffect(() => { localStorage.setItem('gplay-dev-favorites', JSON.stringify(devFavorites)) }, [devFavorites])

  const toggleDevFavorite = (dev) => {
    setDevFavorites(prev => {
      const exists = prev.find(f => f.developerId === dev.developerId)
      if (exists) return prev.filter(f => f.developerId !== dev.developerId)
      return [...prev, { developerId: dev.developerId, developer: dev.developer, icon: dev.icon }]
    })
  }

  const isDevFavorite = (developerId) => devFavorites.some(f => f.developerId === developerId)

  const searchDeveloper = (developerId) => {
    setSearchType('Developer ID')
    setSearchTerm(developerId)
    handleSearch(developerId, 'Developer ID', langCountry)
  }

  const handleSearch = async (term = searchTerm, type = searchType, lc = langCountry) => {
    if (!term.trim()) return
    setLoading(true); setError(null); setDevStats(null); setActiveTab('search'); setExpandedApp(null)
    const { lang, country } = langCountryMap[lc] || langCountryMap['ko-KR']
    const params = new URLSearchParams({ query: term, search_type: type, lang, country })
    window.history.pushState({}, '', `?search_type=${type}&lang_country=${lc}&search_term=${term}`)
    try {
      const res = await fetch(`${API_URL}/api/search?${params}`)
      const data = await res.json()
      if (data.success) {
        setApps(data.apps || [])
        if (data.developer_stats) setDevStats(data.developer_stats)
      } else {
        setError(data.error)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const onSubmit = (e) => { e.preventDefault(); handleSearch() }

  const formatNumber = (n) => {
    if (!n) return '0'
    if (typeof n === 'string') n = parseInt(n.replace(/[,+]/g, ''), 10)
    if (isNaN(n)) return '0'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return n.toString()
  }

  const displayApps = activeTab === 'search' ? apps : []

  const RatingBar = ({ histogram }) => {
    if (!histogram || histogram.length < 5) return null
    const max = Math.max(...histogram, 1)
    return (
      <div className="flex items-end gap-0.5 h-8">
        {histogram.map((count, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="w-full bg-[#0a0a0a] transition-all" style={{ height: `${Math.max((count / max) * 28, 2)}px` }} />
            <span className="text-[8px] text-[#999]">{5 - i}</span>
          </div>
        )).reverse()}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'Inter', 'Pretendard', sans-serif" }}>
      {/* Header */}
      <header className="bg-[#0a0a0a] text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight cursor-pointer" onClick={() => window.location.href = '/'}>GPLAY</h1>
            <span className="text-[#555] text-xs hidden sm:inline">Google Play Analytics</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Search */}
        <form onSubmit={onSubmit} className="bg-white border-2 border-[#0a0a0a] p-5 mb-5">
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-[#999] mb-1.5 uppercase tracking-widest">Type</label>
              <div className="flex gap-1.5">
                {['Keyword', 'Developer ID'].map(type => (
                  <button key={type} type="button" onClick={() => setSearchType(type)}
                    className={`flex-1 py-2 px-2 text-xs font-bold border-2 transition-all ${searchType === type ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-white text-[#0a0a0a] border-[#e0e0e0] hover:border-[#0a0a0a]'}`}>
                    {type === 'Keyword' ? 'KEYWORD' : 'DEVELOPER'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#999] mb-1.5 uppercase tracking-widest">Region</label>
              <select value={langCountry} onChange={(e) => setLangCountry(e.target.value)}
                className="w-full py-2 px-2 border-2 border-[#e0e0e0] text-xs font-medium focus:border-[#0a0a0a] outline-none">
                {Object.entries(langCountryMap).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchType === 'Keyword' ? '앱 이름이나 키워드...' : '개발사 ID...'}
              className="flex-1 py-3 px-4 border-2 border-[#e0e0e0] text-sm font-medium focus:border-[#0a0a0a] outline-none transition-colors" />
            <button type="submit" disabled={loading}
              className="px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all min-w-[100px] bg-[#0a0a0a] text-white hover:bg-[#333]">
              {loading ? <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></span> : 'SEARCH'}
            </button>
          </div>
        </form>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border-b-2 border-[#0a0a0a]">
          {[
            { id: 'search', label: 'Results', count: apps.length },
            { id: 'developers', label: '★ Developers', count: devFavorites.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-b-0 transition-colors ${activeTab === tab.id ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-white text-[#999] border-transparent hover:text-[#0a0a0a]'}`}>
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-white border-2 border-red-500 p-4 mb-5">
            <p className="text-red-600 font-bold text-xs">{error}</p>
          </div>
        )}

        {/* Developer Stats */}
        {devStats && activeTab === 'search' && (
          <div className="bg-white border-2 border-[#0a0a0a] p-5 mb-5">
            <h3 className="text-sm font-black text-[#0a0a0a] mb-3 uppercase tracking-wider">Developer Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              {[
                { label: 'Apps', value: devStats.total_apps },
                { label: 'Total Installs', value: formatNumber(devStats.total_installs) },
                { label: 'Avg Rating', value: devStats.avg_rating?.toFixed(1) || 'N/A' },
                { label: 'Free / Paid', value: `${devStats.free_count || 0} / ${devStats.paid_count || 0}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-[#999] uppercase tracking-widest">{label}</p>
                  <p className="text-xl font-black">{value}</p>
                </div>
              ))}
            </div>
            {devStats.genres && Object.keys(devStats.genres).length > 0 && (
              <div className="border-t-2 border-[#eee] pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(devStats.genres).sort((a, b) => b[1] - a[1]).map(([g, c]) => (
                    <span key={g} className="px-2 py-0.5 bg-[#f0f0f0] text-[10px] font-bold">{g} ({c})</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Developer Favorites Tab */}
        {activeTab === 'developers' && (
          <div className="space-y-2">
            {devFavorites.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">🏢</div>
                <p className="text-[#999] text-xs uppercase tracking-widest">저장된 개발사가 없습니다</p>
                <p className="text-[#bbb] text-xs mt-2">검색 결과에서 개발사 이름을 클릭하면 즐겨찾기에 추가됩니다</p>
              </div>
            ) : devFavorites.map((dev) => (
              <div key={dev.developerId} className="bg-white border-2 border-[#eee] hover:border-[#0a0a0a] transition-all p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {dev.icon && <img src={dev.icon} alt="" className="w-8 h-8 rounded" />}
                  <div>
                    <button onClick={() => searchDeveloper(dev.developerId)} className="text-sm font-black text-[#0a0a0a] hover:underline">{dev.developer}</button>
                    <p className="text-[10px] text-[#999]">{dev.developerId}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => searchDeveloper(dev.developerId)} className="px-3 py-1 text-xs font-bold bg-[#0a0a0a] text-white hover:bg-[#333] transition-colors">검색</button>
                  <button onClick={() => toggleDevFavorite(dev)} className="px-3 py-1 text-xs font-bold border-2 border-red-400 text-red-500 hover:bg-red-50 transition-colors">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border-2 border-[#eee] p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-[#eee] rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2"><div className="h-4 bg-[#eee] rounded w-2/3" /><div className="h-3 bg-[#f0f0f0] rounded w-1/3" /><div className="h-3 bg-[#f5f5f5] rounded w-1/2" /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && activeTab === 'search' && displayApps.length > 0 && (
          <div className="space-y-2">
            {displayApps.map((app, idx) => {
              const isExpanded = expandedApp === app.appId
              return (
                <div key={app.appId || idx} className="bg-white border-2 border-[#eee] hover:border-[#0a0a0a] transition-all group">
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedApp(isExpanded ? null : app.appId)}>
                    <div className="flex gap-3">
                      <img src={app.icon} alt={app.title} className="w-14 h-14 rounded-xl flex-shrink-0 bg-[#f5f5f5]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-black text-[#0a0a0a] truncate">{app.title}</h3>
                            <button onClick={(e) => { e.stopPropagation(); searchDeveloper(app.developerId || app.developer) }}
                              className="text-xs text-[#666] hover:text-[#0a0a0a] hover:underline">{app.developer}</button>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); toggleDevFavorite({ developerId: app.developerId || app.developer, developer: app.developer, icon: app.icon }) }}
                              className={`w-7 h-7 flex items-center justify-center border-2 transition-all text-xs ${isDevFavorite(app.developerId || app.developer) ? 'bg-[#0a0a0a] border-[#0a0a0a] text-yellow-400' : 'bg-white border-[#e0e0e0] text-[#ccc] hover:border-[#0a0a0a]'}`}
                              title="개발사 즐겨찾기">🏢</button>
                            <div className={`w-7 h-7 flex items-center justify-center border-2 border-[#e0e0e0] text-[#999] text-xs transition-all ${isExpanded ? 'bg-[#0a0a0a] border-[#0a0a0a] text-white' : ''}`}>
                              {isExpanded ? '−' : '+'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[#999]">
                          {app.score && <span>⭐ {Number(app.score).toFixed(1)}</span>}
                          <span>📥 {formatNumber(app.realInstalls || app.installs)}</span>
                          {app.genre && <span className="px-1.5 py-0 bg-[#f0f0f0] text-[10px] font-medium">{app.genre}</span>}
                          {app.free === false && <span className="px-1.5 py-0 bg-amber-100 text-amber-700 text-[10px] font-medium">{app.price} {app.currency}</span>}
                          {app.containsAds && <span className="text-[10px] text-[#bbb]">AD</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t-2 border-[#eee] p-4 bg-[#fafafa]">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { l: '출시일', v: app.release_date },
                              { l: '업데이트', v: app.update_date },
                              { l: '버전', v: app.version },
                              { l: '최소 Android', v: app.androidVersion },
                              { l: '실제 설치', v: formatNumber(app.realInstalls) },
                              { l: '리뷰 수', v: formatNumber(app.reviews) },
                              { l: '연령 등급', v: app.contentRating },
                              { l: '인앱 결제', v: app.inAppProductPrice || '없음' },
                            ].map(({ l, v }) => v && v !== 'N/A' && v !== 'Varies with device' && (
                              <div key={l}>
                                <p className="text-[10px] text-[#999] uppercase tracking-widest">{l}</p>
                                <p className="text-xs font-bold text-[#0a0a0a]">{v}</p>
                              </div>
                            ))}
                          </div>

                          {app.histogram && (
                            <div>
                              <p className="text-[10px] text-[#999] uppercase tracking-widest mb-1">평점 분포</p>
                              <RatingBar histogram={app.histogram} />
                            </div>
                          )}

                          {app.recentChanges && (
                            <div>
                              <p className="text-[10px] text-[#999] uppercase tracking-widest mb-1">최근 변경사항</p>
                              <p className="text-xs text-[#666] leading-relaxed" dangerouslySetInnerHTML={{ __html: app.recentChanges }} />
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {app.description && (
                            <div>
                              <p className="text-[10px] text-[#999] uppercase tracking-widest mb-1">설명</p>
                              <p className="text-xs text-[#666] leading-relaxed line-clamp-6">{app.description}</p>
                            </div>
                          )}

                          {app.screenshots && app.screenshots.length > 0 && (
                            <div>
                              <p className="text-[10px] text-[#999] uppercase tracking-widest mb-1">스크린샷</p>
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {app.screenshots.map((s, i) => (
                                  <img key={i} src={s} alt="" className="h-32 rounded border border-[#eee] flex-shrink-0" loading="lazy" />
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="border-t border-[#eee] pt-2">
                            <p className="text-[10px] text-[#999] uppercase tracking-widest mb-1">개발사 정보</p>
                            <div className="space-y-1 text-xs text-[#666]">
                              {app.developerEmail && <p>📧 <a href={`mailto:${app.developerEmail}`} className="hover:underline">{app.developerEmail}</a></p>}
                              {app.developerWebsite && <p>🌐 <a href={app.developerWebsite} target="_blank" rel="noopener noreferrer" className="hover:underline truncate inline-block max-w-[250px] align-bottom">{app.developerWebsite}</a></p>}
                              {app.developerAddress && <p className="text-[11px] text-[#999]">📍 {app.developerAddress}</p>}
                              {app.privacyPolicy && <p><a href={app.privacyPolicy} target="_blank" rel="noopener noreferrer" className="text-[10px] underline text-[#999]">개인정보 처리방침</a></p>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-3 pt-3 border-t border-[#eee]">
                        <a href={`https://play.google.com/store/apps/details?id=${app.appId}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold text-[#0a0a0a] underline hover:no-underline">PLAY STORE →</a>
                        <button onClick={(e) => { e.stopPropagation(); searchDeveloper(app.developerId || app.developer) }}
                          className="text-xs font-bold text-[#666] hover:text-[#0a0a0a] underline hover:no-underline">이 개발사 앱 보기 →</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && activeTab === 'search' && displayApps.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-[#999] text-xs uppercase tracking-widest">
              {searchTerm ? '검색 결과가 없습니다' : '검색어를 입력하세요'}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-[#eee] mt-16">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <p className="text-[10px] text-[#ccc] uppercase tracking-widest">Google Play Search & Analytics Tool</p>
        </div>
      </footer>
    </div>
  )
}
