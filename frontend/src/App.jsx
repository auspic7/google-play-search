import React, { useState, useEffect, useCallback, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function App() {
  const [searchType, setSearchType] = useState('Keyword')
  const [langCountry, setLangCountry] = useState('ko-KR')
  const [searchTerm, setSearchTerm] = useState('')
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('search')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gplay-favorites') || '[]') } catch { return [] }
  })
  const [devStats, setDevStats] = useState(null)

  // Auth state
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('gplay-token') || null)
  const googleBtnRef = useRef(null)

  // Rate limit state
  const [rateLimit, setRateLimit] = useState(null)

  const langCountryMap = {
    'ko-KR': { lang: 'ko', country: 'kr', label: '🇰🇷 한국어' },
    'en-US': { lang: 'en', country: 'us', label: '🇺🇸 English' },
    'ja-JP': { lang: 'ja', country: 'jp', label: '🇯🇵 日本語' },
  }

  // Auth headers helper
  const authHeaders = useCallback(() => {
    if (!token) return {}
    return { 'Authorization': `Bearer ${token}` }
  }, [token])

  // Fetch rate limit
  const fetchRateLimit = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rate-limit`, { headers: authHeaders() })
      const data = await res.json()
      setRateLimit(data)
    } catch { /* silent */ }
  }, [authHeaders])

  // Google Sign-In callback
  const handleCredentialResponse = useCallback(async (response) => {
    const idToken = response.credential
    try {
      const res = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)
        setToken(idToken)
        localStorage.setItem('gplay-token', idToken)
      }
    } catch (err) {
      console.error('Auth failed:', err)
    }
  }, [])

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(initGoogle, 200)
        return
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      })
      // If we have a stored token, verify it
      if (token) {
        fetch(`${API_URL}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(data => {
          if (data.authenticated) {
            setUser(data.user)
          } else {
            setToken(null)
            setUser(null)
            localStorage.removeItem('gplay-token')
          }
        }).catch(() => {
          setToken(null)
          setUser(null)
          localStorage.removeItem('gplay-token')
        })
      }
      // Render the button in hidden div for prompt fallback
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 240,
        })
      }
    }
    initGoogle()
  }, [handleCredentialResponse, token])

  // Fetch rate limit on mount and after auth change
  useEffect(() => { fetchRateLimit() }, [fetchRateLimit])

  // URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('search_term')) {
      setSearchType(params.get('search_type') || 'Keyword')
      setLangCountry(params.get('lang_country') || 'ko-KR')
      setSearchTerm(params.get('search_term'))
      handleSearch(params.get('search_term'), params.get('search_type'), params.get('lang_country'))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('gplay-favorites', JSON.stringify(favorites))
  }, [favorites])

  const toggleFavorite = (app) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.appId === app.appId)
      if (exists) return prev.filter(f => f.appId !== app.appId)
      return [...prev, { appId: app.appId, title: app.title, icon: app.icon, developer: app.developer, score: app.score, installs: app.installs }]
    })
  }

  const isFavorite = (appId) => favorites.some(f => f.appId === appId)

  const handleSearch = async (term = searchTerm, type = searchType, lc = langCountry) => {
    if (!term.trim()) return
    setLoading(true)
    setError(null)
    setDevStats(null)
    setActiveTab('search')

    const { lang, country } = langCountryMap[lc] || langCountryMap['ko-KR']
    const params = new URLSearchParams({ query: term, search_type: type, lang, country })
    window.history.pushState({}, '', `?search_type=${type}&lang_country=${lc}&search_term=${term}`)

    try {
      const res = await fetch(`${API_URL}/api/search?${params}`, { headers: authHeaders() })
      const data = await res.json()

      if (data.success) {
        setApps(data.apps || [])
        if (data.developer_stats) setDevStats(data.developer_stats)
        if (data.rate_limit) setRateLimit(data.rate_limit)
      } else {
        setError(data.error)
        if (data.rate_limit) setRateLimit(data.rate_limit)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => { e.preventDefault(); handleSearch() }

  const handleSignOut = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('gplay-token')
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    fetchRateLimit()
  }

  const handleSignIn = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  const displayApps = activeTab === 'favorites' ? favorites : apps

  const formatNumber = (n) => {
    if (!n) return '0'
    if (typeof n === 'string') n = parseInt(n.replace(/[,+]/g, ''), 10)
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return n.toString()
  }

  const isLimitReached = rateLimit && rateLimit.remaining <= 0
  const limitDisplay = rateLimit ? `${rateLimit.used}/${rateLimit.limit}` : null

  return (
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'Inter', 'Pretendard', sans-serif" }}>
      {/* Header Bar */}
      <header className="bg-[#0a0a0a] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tight">GPLAY SEARCH</h1>
            <span className="text-[#666] text-xs hidden sm:inline">Google Play Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-[#333]"
                  referrerPolicy="no-referrer"
                />
                <span className="text-sm text-[#ccc] hidden sm:inline">{user.name}</span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-[#666] hover:text-white transition-colors ml-1"
                >
                  로그아웃
                </button>
              </div>
            ) : GOOGLE_CLIENT_ID ? (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-3 py-1.5 bg-white text-[#0a0a0a] text-xs font-bold rounded hover:bg-[#eee] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                로그인
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hidden Google Sign-In button (for prompt fallback) */}
      <div ref={googleBtnRef} className="hidden" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={onSubmit} className="bg-white border-2 border-[#0a0a0a] p-5 mb-6">
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-[#999] mb-1.5 uppercase tracking-widest">Type</label>
              <div className="flex gap-1.5">
                {['Keyword', 'Developer ID'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSearchType(type)}
                    className={`flex-1 py-2 px-2 text-xs font-bold border-2 transition-all ${
                      searchType === type
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                        : 'bg-white text-[#0a0a0a] border-[#e0e0e0] hover:border-[#0a0a0a]'
                    }`}
                  >
                    {type === 'Keyword' ? 'KEYWORD' : 'DEVELOPER'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#999] mb-1.5 uppercase tracking-widest">Region</label>
              <select
                value={langCountry}
                onChange={(e) => setLangCountry(e.target.value)}
                className="w-full py-2 px-2 border-2 border-[#e0e0e0] text-xs font-medium focus:border-[#0a0a0a] outline-none"
              >
                {Object.entries(langCountryMap).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              {/* Rate limit badge */}
              {limitDisplay && (
                <div className={`flex items-center gap-1.5 px-3 py-2 border-2 text-xs font-bold w-full ${
                  isLimitReached
                    ? 'bg-red-50 border-red-400 text-red-600'
                    : rateLimit && rateLimit.remaining <= 3
                    ? 'bg-amber-50 border-amber-400 text-amber-700'
                    : 'bg-[#f5f5f5] border-[#e0e0e0] text-[#666]'
                }`}>
                  <span className="text-base">{isLimitReached ? '🚫' : '🔍'}</span>
                  <span>오늘 {limitDisplay}회 사용</span>
                  {!rateLimit?.authenticated && !isLimitReached && (
                    <span className="text-[10px] text-[#999] ml-auto">로그인 시 {30}회</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchType === 'Keyword' ? '앱 이름이나 키워드 검색...' : '개발사 ID 입력...'}
              className="flex-1 py-3 px-4 border-2 border-[#e0e0e0] text-sm font-medium focus:border-[#0a0a0a] outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={loading || isLimitReached}
              className={`px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all min-w-[100px] ${
                isLimitReached
                  ? 'bg-[#ccc] text-[#999] cursor-not-allowed'
                  : 'bg-[#0a0a0a] text-white hover:bg-[#333]'
              } disabled:opacity-50`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  검색 중
                </span>
              ) : 'SEARCH'}
            </button>
          </div>

          {/* Limit reached message */}
          {isLimitReached && (
            <div className="mt-3 p-3 bg-red-50 border-2 border-red-200 flex items-center justify-between">
              <span className="text-xs text-red-700 font-medium">
                오늘 검색 한도에 도달했습니다.
              </span>
              {!user && GOOGLE_CLIENT_ID && (
                <button
                  onClick={handleSignIn}
                  className="text-xs font-bold text-[#0a0a0a] underline hover:no-underline"
                >
                  로그인하면 30회까지 검색 가능 →
                </button>
              )}
            </div>
          )}
        </form>

        {/* Tabs */}
        <div className="flex gap-0 mb-5 border-b-2 border-[#0a0a0a]">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-b-0 transition-colors ${
              activeTab === 'search'
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                : 'bg-white text-[#999] border-transparent hover:text-[#0a0a0a]'
            }`}
          >
            Results {apps.length > 0 && `(${apps.length})`}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-b-0 transition-colors ${
              activeTab === 'favorites'
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                : 'bg-white text-[#999] border-transparent hover:text-[#0a0a0a]'
            }`}
          >
            ★ Saved {favorites.length > 0 && `(${favorites.length})`}
          </button>
        </div>

        {/* Error */}
        {error && error !== 'Daily search limit reached' && (
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
                  <p className="text-xl font-black text-[#0a0a0a]">{value}</p>
                </div>
              ))}
            </div>
            {devStats.genres && Object.keys(devStats.genres).length > 0 && (
              <div className="border-t-2 border-[#eee] pt-3">
                <p className="text-[10px] text-[#999] uppercase tracking-widest mb-2">Genres</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(devStats.genres).sort((a, b) => b[1] - a[1]).map(([genre, count]) => (
                    <span key={genre} className="px-2 py-0.5 bg-[#f0f0f0] text-[10px] font-bold text-[#0a0a0a]">
                      {genre} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border-2 border-[#eee] p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-[#eee] rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#eee] rounded w-2/3" />
                    <div className="h-3 bg-[#f0f0f0] rounded w-1/3" />
                    <div className="h-3 bg-[#f5f5f5] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && displayApps.length > 0 && (
          <div className="space-y-2">
            {displayApps.map((app, idx) => (
              <div
                key={app.appId || idx}
                className="bg-white border-2 border-[#eee] hover:border-[#0a0a0a] transition-all p-4 group"
              >
                <div className="flex gap-3">
                  <img
                    src={app.icon}
                    alt={app.title}
                    className="w-14 h-14 rounded-lg flex-shrink-0 bg-[#f5f5f5]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-[#0a0a0a] truncate">{app.title}</h3>
                        <p className="text-xs text-[#888]">{app.developer}</p>
                      </div>
                      <button
                        onClick={() => toggleFavorite(app)}
                        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 transition-all text-sm ${
                          isFavorite(app.appId)
                            ? 'bg-[#0a0a0a] border-[#0a0a0a] text-yellow-400'
                            : 'bg-white border-[#e0e0e0] text-[#ccc] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                        }`}
                      >
                        ★
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-[#999]">
                      {app.score && <span>⭐ {Number(app.score).toFixed(1)}</span>}
                      {app.installs && <span>📥 {app.installs}</span>}
                      {app.release_date && app.release_date !== 'N/A' && <span>📅 {app.release_date}</span>}
                      {app.update_date && app.update_date !== 'N/A' && <span>🔄 {app.update_date}</span>}
                    </div>
                    <a
                      href={`https://play.google.com/store/apps/details?id=${app.appId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-[11px] font-bold text-[#0a0a0a] underline hover:no-underline opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      PLAY STORE →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && displayApps.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">{activeTab === 'favorites' ? '★' : '🔍'}</div>
            <p className="text-[#999] text-xs uppercase tracking-widest">
              {activeTab === 'favorites' ? '저장된 앱이 없습니다' : searchTerm ? '검색 결과가 없습니다' : '검색어를 입력하세요'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#eee] mt-16">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <p className="text-[10px] text-[#ccc] uppercase tracking-widest">Google Play Search Tool</p>
        </div>
      </footer>
    </div>
  )
}
