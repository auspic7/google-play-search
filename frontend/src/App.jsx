import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [searchType, setSearchType] = useState('Keyword')
  const [langCountry, setLangCountry] = useState('ko-KR')
  const [searchTerm, setSearchTerm] = useState('')
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('search')
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gplay-favorites') || '[]')
    } catch { return [] }
  })
  const [devStats, setDevStats] = useState(null)

  const langCountryMap = {
    'ko-KR': { lang: 'ko', country: 'kr', label: '🇰🇷 한국어 (대한민국)' },
    'en-US': { lang: 'en', country: 'us', label: '🇺🇸 English (US)' },
  }

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

    const { lang, country } = langCountryMap[lc]
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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    handleSearch()
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

  return (
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'Inter', 'Pretendard', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-[#0a0a0a] mb-1">
            GPLAY SEARCH
          </h1>
          <p className="text-[#666] text-sm tracking-wide uppercase">Google Play App & Developer Search</p>
        </div>

        {/* Search Form */}
        <form onSubmit={onSubmit} className="bg-white border-2 border-[#0a0a0a] p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-[#0a0a0a] mb-2 uppercase tracking-wider">Type</label>
              <div className="flex gap-2">
                {['Keyword', 'Developer ID'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSearchType(type)}
                    className={`flex-1 py-2 px-3 text-sm font-bold border-2 transition-colors ${
                      searchType === type
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                        : 'bg-white text-[#0a0a0a] border-[#ddd] hover:border-[#0a0a0a]'
                    }`}
                  >
                    {type === 'Keyword' ? 'KEYWORD' : 'DEVELOPER'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0a0a0a] mb-2 uppercase tracking-wider">Region</label>
              <select
                value={langCountry}
                onChange={(e) => setLangCountry(e.target.value)}
                className="w-full py-2 px-3 border-2 border-[#ddd] text-sm font-medium focus:border-[#0a0a0a] outline-none"
              >
                {Object.entries(langCountryMap).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="flex-1 py-3 px-4 border-2 border-[#ddd] text-base font-medium focus:border-[#0a0a0a] outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-[#0a0a0a] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'SEARCH'}
            </button>
          </div>
        </form>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b-2 border-[#0a0a0a]">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider border-2 border-b-0 transition-colors ${
              activeTab === 'search'
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                : 'bg-white text-[#999] border-transparent hover:text-[#0a0a0a]'
            }`}
          >
            Results {apps.length > 0 && `(${apps.length})`}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider border-2 border-b-0 transition-colors ${
              activeTab === 'favorites'
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                : 'bg-white text-[#999] border-transparent hover:text-[#0a0a0a]'
            }`}
          >
            Favorites {favorites.length > 0 && `(${favorites.length})`}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white border-2 border-red-600 p-4 mb-6">
            <p className="text-red-600 font-bold text-sm">{error}</p>
          </div>
        )}

        {/* Developer Stats */}
        {devStats && activeTab === 'search' && (
          <div className="bg-white border-2 border-[#0a0a0a] p-6 mb-6">
            <h3 className="text-lg font-black text-[#0a0a0a] mb-4 uppercase tracking-wider">Developer Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-[#999] uppercase tracking-wider">Apps</p>
                <p className="text-2xl font-black text-[#0a0a0a]">{devStats.total_apps}</p>
              </div>
              <div>
                <p className="text-xs text-[#999] uppercase tracking-wider">Total Installs</p>
                <p className="text-2xl font-black text-[#0a0a0a]">{formatNumber(devStats.total_installs)}</p>
              </div>
              <div>
                <p className="text-xs text-[#999] uppercase tracking-wider">Avg Rating</p>
                <p className="text-2xl font-black text-[#0a0a0a]">{devStats.avg_rating?.toFixed(1) || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-[#999] uppercase tracking-wider">Free / Paid</p>
                <p className="text-2xl font-black text-[#0a0a0a]">{devStats.free_count || 0} / {devStats.paid_count || 0}</p>
              </div>
            </div>
            {devStats.genres && Object.keys(devStats.genres).length > 0 && (
              <div className="border-t-2 border-[#eee] pt-4">
                <p className="text-xs text-[#999] uppercase tracking-wider mb-2">Genres</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(devStats.genres).sort((a, b) => b[1] - a[1]).map(([genre, count]) => (
                    <span key={genre} className="px-2 py-1 bg-[#f0f0f0] text-xs font-bold text-[#0a0a0a]">
                      {genre} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {displayApps.length > 0 && (
          <div className="space-y-3">
            {displayApps.map((app, idx) => (
              <div key={app.appId || idx} className="bg-white border-2 border-[#eee] hover:border-[#0a0a0a] transition-colors p-4">
                <div className="flex gap-4">
                  <img
                    src={app.icon}
                    alt={app.title}
                    className="w-16 h-16 flex-shrink-0"
                    style={{ imageRendering: 'auto' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-[#0a0a0a] truncate">{app.title}</h3>
                        <p className="text-sm text-[#666]">{app.developer}</p>
                      </div>
                      <button
                        onClick={() => toggleFavorite(app)}
                        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 transition-colors ${
                          isFavorite(app.appId)
                            ? 'bg-[#0a0a0a] border-[#0a0a0a] text-white'
                            : 'bg-white border-[#ddd] text-[#999] hover:border-[#0a0a0a]'
                        }`}
                        title={isFavorite(app.appId) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        ★
                      </button>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-[#999]">
                      <span>⭐ {app.score?.toFixed(1) || '-'}</span>
                      <span>📥 {app.installs || '-'}</span>
                      {app.release_date && app.release_date !== 'N/A' && <span>📅 {app.release_date}</span>}
                      {app.update_date && app.update_date !== 'N/A' && <span>🔄 {app.update_date}</span>}
                    </div>
                    <a
                      href={`https://play.google.com/store/apps/details?id=${app.appId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs font-bold text-[#0a0a0a] underline hover:no-underline"
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
          <div className="text-center py-16">
            <p className="text-[#999] text-sm uppercase tracking-wider">
              {activeTab === 'favorites' ? 'No favorites yet' : searchTerm ? 'No results found' : 'Enter a search term'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
