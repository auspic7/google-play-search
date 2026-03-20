# 🚀 Coolify 배포 가이드

## 📋 사전 준비

1. ✅ GitHub Private 저장소: `https://github.com/auspic7/google-play-search`
2. ✅ Deploy Key 생성 완료
3. ✅ Docker Compose 설정 완료

---

## 🌐 1단계: Cloudflare DNS 설정

**Cloudflare Dashboard**: https://dash.cloudflare.com/

1. **66863409.xyz** 도메인 선택
2. **DNS** → **Records** 클릭
3. **Add record** 클릭

**설정**:
- **Type**: A
- **Name**: gplay
- **IPv4 address**: 124.49.3.31
- **Proxy status**: ✅ Proxied (오렌지 구름)
- **TTL**: Auto

4. **Save** 클릭

---

## 🐳 2단계: Coolify 초기 설정

**Coolify URL**: http://10.0.0.120:8000

### 2.1 관리자 계정 생성 (처음 접속 시)
- Email: `auspic7@gmail.com`
- Name: `Brandon`
- Password: (안전한 비밀번호 입력)

### 2.2 Private Key 추가
1. **Settings** (⚙️) → **Private Keys** 클릭
2. **Add Private Key** 클릭
3. **Name**: `google-play-search-deploy`
4. **Private Key**: 로컬 파일 `~/.ssh/coolify-gplay` 내용 복사

### 2.3 Public Key 확인
GitHub Deploy Key로 추가된 Public Key:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILLfRIQATyX37lvPaFrJbRuLCERzWKgSuY39GzEoXaUk coolify-deploy
```

---

## 📦 3단계: 앱 배포

### 3.1 New Resource 생성
1. **+ New Resource** 클릭
2. **Docker Compose (via Git)** 선택

### 3.2 Git 설정
- **Git Repository**: `git@github.com:auspic7/google-play-search.git`
- **Branch**: `main`
- **Private Key**: `google-play-search-deploy` 선택
- **Docker Compose Location**: `./docker-compose.yml`

### 3.3 Domain 설정
- **Domains** 탭 클릭
- **Add Domain** 클릭
- **Domain**: `gplay.66863409.xyz`
- **Port**: `3000`
- **HTTPS**: ✅ (자동 Let's Encrypt)

### 3.4 Deploy!
- **Deploy** 버튼 클릭
- 빌드 로그 확인 (2-3분 소요)

---

## ✅ 4단계: 배포 확인

**URL**: https://gplay.66863409.xyz

**기능 테스트**:
1. 검색 유형: Keyword / Developer ID
2. 언어: 🇰🇷 한국어 / 🇺🇸 English
3. 검색어: `카카오톡` 또는 `com.kakao.talk`
4. 결과 확인: 아이콘, 평점, 설치 수, 출시일

---

**작성일**: 2026-03-20
