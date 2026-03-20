import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [searchType, setSearchType] = useState('Keyword')
  const [langCountry, setLangCountry] = useState('ko-KR')
  const [searchTerm, setSearchTerm] = useState('')
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  const handleSearch = async (term = searchTerm, type = searchType, lc = langCountry) => {
    if (!term.trim()) return
    
    setLoading(true)
    setError(null)
    
    const { lang, country } = langCountryMap[lc]
    const params = new URLSearchParams({
      query: term,
      search_type: type,
      lang,
      country,
    })

    window.history.pushState({}, '', `?search_type=${type}&lang_country=${lc}&search_term=${term}`)

    try {
      const res = await fetch(`${API_URL}/api/search?${params}`)
      const data = await res.json()
      
      if (data.success) {
        setApps(data.apps)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Google Play Search
          </h1>
          <p className="text-gray-600 text-lg">앱 검색, 개발자 검색을 한 번에</p>
        </div>

        {/* Search Form */}
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-gray-100">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Search Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">검색 유형</label>
              <div className="flex gap-4">
                {['Keyword', 'Developer ID'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSearchType(type)}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                      searchType === type
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'Keyword' ? '🔍 키워드' : '👨‍💻 개발자'}
                  </button>
                ))}
              </div>
            </div>

            {/* Language/Country */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">언어 / 국가</label>
              <select
                value={langCountry}
                onChange={(e) => setLangCountry(e.target.value)}
                className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              >
                {Object.entries(langCountryMap).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="검색어를 입력하세요..."
              className="w-full py-4 px-6 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-lg transition-all"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '🔄 검색 중...' : '🚀 앱 검색'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl mb-12">
            <p className="text-red-700 font-medium">❌ 오류: {error}</p>
          </div>
        )}

        {/* Results */}
        {apps.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                검색 결과 <span className="text-indigo-600">({apps.length}개)</span>
              </h2>
            </div>

            <div className="grid gap-6">
              {apps.map((app, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border border-gray-100">
                  <div className="flex gap-6">
                    {/* Icon */}
                    <img
                      src={app.icon}
                      alt={app.title}
                      className="w-24 h-24 rounded-2xl shadow-md flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{app.title}</h3>
                      <p className="text-gray-600 mb-3">{app.developer}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">⭐ 평점</span>
                          <p className="font-semibold text-gray-900">{app.score?.toFixed(1) || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">📥 설치 수</span>
                          <p className="font-semibold text-gray-900">{app.installs || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">📅 출시일</span>
                          <p className="font-semibold text-gray-900">{app.release_date || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">🔄 업데이트</span>
                          <p className="font-semibold text-gray-900">{app.update_date || 'N/A'}</p>
                        </div>
                      </div>

                      <a
                        href={`https://play.google.com/store/apps/details?id=${app.appId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium"
                      >
                        앱 보기 →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && apps.length === 0 && searchTerm && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
