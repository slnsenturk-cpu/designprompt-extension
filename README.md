# DesignPrompt — Vibe Inspector

Herhangi bir sitede beğendiğin tasarım detayını otomatik olarak vibe coding promptuna çeviren Chrome Extension.

---

## Kurulum

1. Bu klasörü bir yere kaydet (zip'i aç)
2. Chrome'da `chrome://extensions` adresine git
3. Sağ üstten **"Developer mode"** açık değilse aç
4. **"Load unpacked"** butonuna tıkla
5. Bu klasörü seç
6. Extension araç çubuğuna sabitle

---

## Kullanım

### 1. API Key Ekle
Extension'ı ilk açtığında API key paneli otomatik açılır.
- [console.anthropic.com](https://console.anthropic.com) adresinden `sk-ant-...` ile başlayan key'ini al
- Panele yapıştır, **Kaydet**'e bas
- Key sadece tarayıcında `chrome.storage.local`'da tutulur, hiçbir yere gönderilmez

### 2. Tüm Sayfa Analizi
- Analiz etmek istediğin siteye git
- Extension'ı aç
- **"Tüm Sayfa"** sekmesi seçili olsun
- **Hedef platform** seç (v0.dev, Bolt, Lovable veya Genel)
- **Odak noktası** seç (Tümü, Renkler, Tipografi...)
- **"Sayfayı Analiz Et"** butonuna bas

### 3. Tekil Element Seçimi
- **"Element Seç"** sekmesine geç
- **"Element Seç"** butonuna bas — imleç crosshair'e döner
- Sayfada istediğin elemente hover et (mavi outline görünür)
- Elementin üstüne tıkla
- `ESC` ile iptal edebilirsin

### 4. Prompt'u Kullan
- **"Kopyala"** ile panoya al
- Ya da **v0.dev / Bolt / Lovable** kısayol butonlarına bas
  - Bu butonlar hem kopyalar hem de ilgili siteyi yeni sekmede açar

---

## Desteklenen Platformlar
- **v0.dev** — React + Tailwind + shadcn/ui
- **Bolt.new** — Full-stack Vite + React
- **Lovable.dev** — React + Supabase
- **Genel** — Herhangi bir AI code tool

---

## Teknik Notlar
- Content script sadece butona basıldığında inject edilir
- Cross-origin iframe içerikleri taranamaz (tarayıcı güvenlik kısıtı)
- Bazı SPAlar dinamik stil yükler; analiz butonu sayfa tam yüklendikten sonra basılmalı
- Extension Manifest V3 kullanır

---

## Olası Sorunlar

**"Sayfa verisi alınamadı" hatası**
→ Sayfayı yenile ve tekrar dene. Bazı `chrome://` sayfalarında çalışmaz.

**API key hatası**
→ ⚙ ikonuna bas, key'i kontrol et.

**Boş veya zayıf prompt**
→ Sayfa CSS custom property kullanmıyor olabilir. "Odak noktası" değiştirerek tekrar dene.
