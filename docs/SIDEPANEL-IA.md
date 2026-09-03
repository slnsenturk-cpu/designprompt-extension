# VibeDesign Yan Panel — Bilgi Mimarisi ve UI Spec (v3.0)

**Tarih:** 29 Ağustos 2026 · **Kapsam:** sidepanel + popup · **Uygulama:** Prompt 3 (bu dokümanın sonunda)

> Bu doküman "ne var, nerede durur, nasıl görünür" sorularını cevaplar. Claude Code bunu okuyup uygular; sen de bittiğinde 11. bölümdeki kontrol listesiyle sınarsın.

---

## 0. Teşhis — bugünkü panel neden okunmuyor

1. **Konfigürasyon yolu kapatıyor.** AI sağlayıcı, model, anahtar, geliştirici bölümü ana akışın tepesinde; "Analyze" düğmesi ekranın altına düşüyor. İlk açılışta kullanıcı ne yapacağını bulmak için kaydırıyor.
2. **Her şey çip.** Sağlayıcı seçimi, model seçimi, odak filtresi, mod seçimi aynı bileşenle çizilmiş; anlam farkı görünmüyor.
3. **Tek yazı düzeyi.** Bölüm etiketleri (AI PROVIDER, MODEL, FOCUS, DEVELOPER) mono-uppercase ve aynı boyda; başlık, etiket ve meta bilgi ayrışmıyor.
4. **Sonuç bir döküm.** Analiz sonucu yapılandırılmış özet değil, ham metin. Kullanıcı "ne bulundu" sorusuna cevap almadan 30k karakter görüyor.
5. **Gürültü.** Model dürtmesi, "2 of 5 free prompts" kutusu, sürüm çipi, sekme çubuğu; hepsi aynı anda ve aynı ağırlıkta.
6. **Gezinme yok.** Kategoriler arasında gezinmek için tek yol kaydırmak; nerede olduğunu gösteren sabit bir yapı yok.

---

## 1. Tasarım ilkeleri (çakışmada sıra önemlidir)

| # | İlke | Ne demek | Uygula | Uygulama |
|---|---|---|---|---|
| 1 | **Ekran başına bir iş** | Her ekranın tek birincil eylemi vardır ve ilk bakışta görünür. | Home'da "Analyze page"; Result'ta "Export". | Analyze düğmesinin altında ikinci bir büyük düğme olmaz. |
| 2 | **Ayarlar kapının arkasında** | Konfigürasyon ana yolda durmaz; bir dokunuşla açılır, kapanır. | AI sağlayıcı/model/anahtar Settings'te. | Anahtar alanı Home'da görünmez. |
| 3 | **Önce özet, sonra döküm** | Sonuç önce sayılar, palet ve anlık görünüm; ham metin isteyene. | Summary strip → Snapshot → Export → bölümler → Preview. | Prompt metni varsayılan görünüm değildir. |
| 4 | **Aşamalı açılım** | Overview özet gösterir; tam listeler kategori sekmelerinde. | Overview'da palet şeridi; Colors sekmesinde 11 rol. | Overview'da 16 keyframe listelenmez. |
| 5 | **Anlam başına bir bileşen** | Aynı bileşen iki farklı anlam taşımaz. | Segmented = mod; Chip = filtre; List = seçim. | Model seçimi çip olmaz, liste olur. |

---

## 2. Nesne modeli (content model)

Panelin gösterdiği her şey bu beş nesneden biridir. UI, nesneleri değil, nesnelerin alanlarını gösterir.

| Nesne | Alanlar (gösterilen) | Kaynak |
|---|---|---|
| **Capture** | sourceType (website/image), domain veya görsel küçük resmi, url, capturedAt, scope (page/element; yalnız website), status | content.js / vision çağrısı |
| **Design model** | theme, styleLine, colors[role], fonts[role+availability], typeScale, spacing, shape, shadows, motion{keyframes, ambient}, states, anatomy, a11y, counts; **confidence: measured / estimated** (kaynak türüne göre) | lib/design-model.js |
| **Output** | kind (prompt / design-md / skill), size, sections, focus (prompt only), target (prompt only) | prompt-builder / design-md-builder / skill-builder |
| **Settings** | account, aiEnhancement{provider, model, keyPresent}, defaults{output, target}, developer | chrome.storage |
| **History item** | Capture + Design model özeti + outputs | storage / cloud |

Kural: bir alan modelde yoksa UI'da da yoktur. UI için yeni veri uydurulmaz.

---

## 3. Bilgi mimarisi — ekranlar ve gezinme

```
Header (sabit, 60px, iki satır):
   satır 1:  [wordmark 18px]                                   [avatar | Sign in]
   satır 2:  [domain 13px · durum caption]                      (ellipsis, tek satır)

İçerik (kayar):         seçili sekmenin içeriği

Alt sekme çubuğu (sticky, 56px, ikon + kısa etiket):
   Overview · Colors · Type · Components · Motion · Settings
```

- **Tek gezinme düzeyi: alt çubuk.** Mobil uygulama sekmesi gibi sticky; içerik kendi içinde kayar. Header'da gezinme yok.
- **Header ölçüleri:** iki satır, toplam 60px. Satır 1: wordmark 18px yüksekliğinde (asset saydam kenarsız, `icons/wordmark.png`), sağda hesap kontrolü. Satır 2: domain 13px `body` + durum `caption`, tek satır, uzun domain ellipsis. Wordmark ile domain aynı satırda yer için yarışmaz.
- **Giriş durumu header'ın sağında görünür:** giriş yapılmışsa 24px avatar (yoksa ilk harf); yapılmamışsa 28px ghost düğme **Sign in**. İkisi de Settings → Account'a gider (Sign in düğmesi doğrudan giriş akışını başlatır). Giriş isteyen her mesaj bir düğmedir, metin değil.
- **Anonim sınır: ayda 5 analiz; ücretsiz kayıt = sınırsız.** Kalan hak, giriş yapılmamışken Analyze düğmesinin altında `caption` olarak görünür: "3 of 5 free analyses this month · Sign in for unlimited". Sınıra gelince Analyze düğmesinin yerini birincil **Sign in for unlimited** düğmesi alır, üstünde tek cümle: "You've used your 5 free analyses this month." "Try again" gibi bir düğme yoktur. Giriş yapılmışsa sayaç hiç görünmez.
- **Alt çubuk ölçüleri:** 6 sekme, her biri ikon (20px) + **etiket** (`label`, 11px); ikon-yalnız çubuk kabul edilmez. Aktif sekme: accent renk + etiket 600; pasif: `text-muted`; analiz yokken kategori sekmeleri %40 opaklık. Dokunma alanı en az 48px yükseklik.
- **"Neredeyim" iki kez cevaplanır:** aktif sekme + her sekme içeriğinin en üstünde `title` (18px) başlık: "Overview", "Colors", "Type", "Components", "Motion", "Settings".
- **Durum, sekmeleri etkiler.** Analiz yokken Overview "Home" içeriğini gösterir (Analyze düğmesi + Recent); kategori sekmeleri soluktur, dokununca "Analyze this page first" notice'ı. Analiz gelince kategoriler açılır.
- **Overview = özet + Export.** Kategori sekmeleri = tam listeler ("See all" katlaması gerekmez); her kategori sekmesinin üstünde küçük bir "Export ▸" kısayolu Overview'daki karta götürür.
- **Settings bir sekmedir**, sheet değil. Account, AI enhancement, Defaults, History, Developer, About onun içinde.
- **Sheet yalnızca geçici yüzeyler için:** "Preview raw output" ve History'nin uzun listesi.
- **Popup = Overview'un kısa hâli.** Popup'ta yalnızca header + Page/Element + Analyze + "Open side panel"; alt çubuk popup'ta yok. Analiz popup'tan başlatılırsa yan panel açılır.

### Sayfa bağlamı — sonuç hangi sayfanın?

Bir sonuç bir sayfaya aittir; kullanıcı sekme değiştirebilir. Kural: **"Analyze page" analizden sonra da hep görünür ve etiketlidir.**

| Durum | Header | Overview'un en üstü |
|---|---|---|
| Analiz yok | `posthog.com · Not analyzed` | Birincil düğme **Analyze page** |
| Sonuç var, aynı sayfadayız | `rig.ai · Analyzed 09:04 PM` | İkincil (ghost) düğme **Re-analyze** — ↺ ikonlu ama etiketli |
| Sonuç var, başka sayfaya geçildi | `posthog.com · Not analyzed` | Notice: "Showing rig.ai (analyzed 09:04 PM)." + birincil düğme **Analyze posthog.com** |

Sekme değişince header anında güncellenir; sonuç silinmez (kullanıcı geri dönebilir). ↺ ikonu tek başına hiçbir yerde kullanılmaz.

### AI göstergesi

Hangi AI'ın çalıştığı ekranda tek satırla görünür; ayarlara gömülmez. Overview'da Analyze/Re-analyze düğmesinin altında `caption`: **"AI enhancement: Claude · Fable 5 · Change"** (Change → Settings sekmesi). Kapalıysa: **"AI enhancement off · Turn on"**. Analiz sürerken ilerleme satırında aynı bilgi.

### Neler gidiyor
`FULL PAGE / GLOBAL TOKENS` sekmeleri · "N of 5 free prompts" kutusu · ana akıştaki AI sağlayıcı/model/anahtar bloğu · header'daki history/account/settings ikonları (Settings sekmesine) · sürüm çipi (Settings → About'a) · model dürtmesi ana akıştan (Settings içinde, tek satır) · Developer bölümü ana akıştan (Settings sonu, yalnız unpacked).

---

## 4. Ekran ekran içerik yapısı

Hiyerarşi düzeyleri: **P1** ilk görülen · **P2** taranan · **P3** istenince okunan · **P4** ince yazı.

### 4.1 Overview — analiz öncesi ("Home" durumu)

```
┌──────────────────────────────────────────────┐
│ vibedesign·   rig.ai · Ready                 │  header
├──────────────────────────────────────────────┤
│                                              │
│   [ Page ] [ Element ]           (segmented) │  P2 · mod
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │            Analyze page              │   │  P1 · birincil eylem
│   └──────────────────────────────────────┘   │
│   Reads colors, type, spacing, components,   │  P3 · tek satır açıklama
│   motion and hover states from this page.    │
│                                              │
│   Recent                                     │  P2 · yalnızca varsa
│   ▸ linear.app        2h ago   dark · 11 col │
│   ▸ vibedesign.tech   1d ago   dark · 9 col  │
│                                              │
├──────────────────────────────────────────────┤
│ ▣ Overview  ◌ Colors  ◌ Type  ◌ Comps  ◌ Motion  ⚙ │  alt çubuk (kategoriler soluk)
└──────────────────────────────────────────────┘
```

Kurallar: bu durumda hiçbir ayar yok. "Element" seçilince düğme "Pick element" olur ve açıklama değişir. Recent boşsa bölüm hiç çizilmez. Soluk sekmeye dokunulursa notice: "Analyze this page first."

### 4.2 Overview — analiz sonrası

```
┌──────────────────────────────────────────────┐
│ vibedesign·   rig.ai · Analyzed 12:41      ↺ │  header (↺ = yeniden analiz)
├──────────────────────────────────────────────┤
│  11        4        7        16              │  P1 · summary strip (stat tiles)
│  Colors    Fonts    Comps    Keyframes       │
│                                              │
│  ■■■■■■■■■■■  (rol renkleri, dokununca ad)   │  P2 · palette strip
│                                              │
│  Snapshot                                    │  P2 · KV listesi
│  Theme        Dark · high contrast           │
│  Style        Chamfered · vivid · animated   │
│  Type         Chalet / Instrument Sans / …   │
│  Shape        Chamfer 14px · radius 0        │
│  Motion       Ambient · 3 loops · 16 kf      │
│  Stack        Astro                          │
│                                              │
│  ┌ Export ──────────────────────────────┐    │  P1 · ikinci birincil alan
│  │ [ Prompt ] [ DESIGN.md ] [ Skill ]   │    │  segmented · output
│  │ Rebuild this page in a chat tool.    │    │  seçime göre tek satır
│  │ For  [ Lovable ▾ ]                   │    │  target (yalnız Prompt)
│  │ Refine ▸ (Focus çipleri, katlı)      │    │  yalnız Prompt
│  │ ┌──────────────────────────────────┐ │    │
│  │ │        Copy prompt               │ │    │  P1 · tek düğme
│  │ └──────────────────────────────────┘ │    │
│  │ 17 sections · 32.6k chars            │    │  P4 · meta
│  └──────────────────────────────────────┘    │
│                                              │
│  Layout                                      │  P2 · yalnız Overview'da
│  Container 90% · Section 128px · 8 sections  │
│                                              │
│  Preview raw output ▸                        │  P3 · isteyene döküm
├──────────────────────────────────────────────┤
│ ▣ Overview  ◌ Colors  ◌ Type  ◌ Comps  ◌ Motion  ⚙ │  alt çubuk (sticky)
└──────────────────────────────────────────────┘
```

**Kategori sekmeleri** (Colors · Type · Components · Motion) aynı iskelette:

```
┌──────────────────────────────────────────────┐
│ vibedesign·   rig.ai · Analyzed 12:41      ↺ │
├──────────────────────────────────────────────┤
│  Colors                          Export ▸    │  P2 · sekme başlığı + kısayol
│  ● background      #0a0a0a   Page canvas     │  KV row, tam liste
│  ● text-primary    #f0eee6   Body, headings  │
│  ● accent          #ed462d   Hero, badges…   │
│  … (11)                                      │
│  Contrast                                    │  P2 · alt bölüm
│  text-primary / background   17.0:1  AAA     │
├──────────────────────────────────────────────┤
│ ◌ Overview  ▣ Colors  ◌ Type  ◌ Comps  ◌ Motion  ⚙ │
└──────────────────────────────────────────────┘
```

- **Type:** aileler (rol · kaynak/lisans · yedek önerisi) · ölçek tablosu (boyut/ağırlık/satır/tracking).
- **Components:** bileşen başına kart-satır: ad · varyant · ölçüler · hover farkı (varsa). Şekil notu (chamfer) en üstte.
- **Motion:** ambient döngüler · keyframe listesi (etkisiyle) · geçişler · etkileşim durumları (measured / recommended ayrı).

Kurallar:
- Summary strip ve palet şeridi Overview'un ilk iki öğesidir; model varsa **her zaman** çizilir. Sayı yoksa yalnızca o tile çizilmez (0 gösterilmez).
- Snapshot değerleri iki satıra sarabilir (Style satırı kesilmez); uzun değer sağa değil, etiketin altına sarar.
- Export kartı **tek** birincil düğme içerir; etiketi output'a göre değişir: *Copy prompt* / *Download DESIGN.md* / *Download Skill*.
- Output açıklamaları sabittir: Prompt → "Rebuild this page in a chat tool." · DESIGN.md → "A style guide your project keeps." · Skill → "DESIGN.md + tokens, packaged for coding agents."
- Target seçici yalnızca Prompt'ta görünür. DESIGN.md ve Skill'de yerine "Where to put it ▸" katlı satırı gelir (araç başına 1 satır).
- Focus çipleri "Refine" altında katlıdır; açılınca seçim Export meta satırına yansır ("Layout · 7 sections · 5.7k chars"). Bölüm sayısı prompt-builder'ın ürettiği `##` bölüm sayısıdır (All için 17); "1 sections" gibi bir değer bir hatadır.
- Overview kategori içeriğini tekrar etmez; kategoriler alt çubuktan açılır ve tam listedir. Her liste tek tip satır kullanır (KV row).
- "Preview raw output" tam metni monospace bir alanda açar; Copy düğmesi orada da vardır.

### 4.3 Settings (sekme)

```
Settings
─────────────────────────────────────────────
Account
  user@example.com                     Sign out
  Session: refreshed 3 min ago               P4

AI enhancement                          [toggle]
  Optional. Improves the prompt's direction   P3
  paragraph. Your key stays in this browser.
  Provider      Claude ▾                      (select, çip değil)
  Model         Sonnet 5 · Fast ▾             (select; "Show all" içinde)
  API key       ••••••••••••••  Change
  ▸ Newer model available: Sonnet 5  Switch   (tek satır, kapatılabilir)

Defaults
  Output        DESIGN.md ▾
  Target        Claude Code ▾

History                                   See all ▸
  rig.ai · 12:41 · linear.app · 2h ago      (son 3; "See all" sheet açar)

Developer   (yalnız unpacked)
  Copy RAW capture

About
  VibeDesign 3.0.3 · Privacy · Support
```

Kurallar: AI enhancement kapalıyken sağlayıcı/model/anahtar satırları gizlidir. "Paid. Get key →" gibi parçalı metinler yok; her bloğun altında tek tam cümle.

### 4.4 History (Settings içinde; uzun liste sheet)

Settings'te son 3; "See all" tam listeyi sheet olarak açar: favicon · domain · zaman · tema/renk sayısı. Satıra dokununca Overview o analizle dolar. Sağ üstte "Clear". Giriş yapılmamışsa altta tek satır: "Sign in to keep history on all your devices."

### 4.5 Durumlar

| Durum | Ne görünür |
|---|---|
| Analiz sürüyor | Analyze düğmesi ilerleme çubuğuna dönüşür: "Reading page… 2/6" (aşama adları: Reading · Colors · Type · Components · Motion · Building · Generating direction). İptal linki. **AI'dan akan metin asla durum satırında gösterilmez**; yalnız aşama adı. |
| Sayfa okunamadı | Notice (uyarı): "Couldn't read this page. Some sites block extensions; try reloading, or pick an element instead." + "Try again". |
| İzin gerekiyor | Notice: "VibeDesign needs permission to read rig.ai." + "Allow" (Prompt 6 akışı). |
| Çevrimdışı / AI hatası | Sonuç yine gelir (kural motoru yereldir); Export meta satırında "AI enhancement skipped — offline". |
| Aylık sınır (anonim) | Analyze düğmesi yerine birincil "Sign in for unlimited"; üstünde "You've used your 5 free analyses this month." Diğer her şey (son sonuç, sekmeler) çalışmaya devam eder. |
| Boş model (çok az veri) | Yalnızca model gerçekten seyrekse (ör. < 3 renk rolü ve hiç bileşen yok): Summary strip yerine tek satır "Very little design data on this page. Try a page with more UI." Sayfa henüz yüklenmediyse bu uyarı yerine "Page is still loading — try again" gösterilir; sayfa yüklenmeden analiz başlatılmaz. |

### 4.6 İki kaynak türü: Website · Image

İki kaynak, iki farklı iş: website analizi **ölçümdür** (DOM'dan okunur), imaj analizi **yorumdur** (vision modeli tahmin eder). Mimari bu farkı her katmanda gösterir; imaj çıktısı asla ölçüm gibi sunulmaz.

**Kaynak seçici:** Overview içeriğinin en üstünde segmented control: **Website · Image**. (Alt çubuk gezinme içindir, kaynak seçimi değildir; alt çubuğa dokunulmaz.) Page/Element alt-modu yalnız Website'ta görünür.

**Website modu** bugünkü akıştır; değişiklik yok.

**Image modu, analiz öncesi:**

```
[ Website | Image ]                       (segmented)
┌ Drop an image or click to choose ┐      (drop zone; png/jpg/webp, ≤8 MB)
└──────────────────────────────────┘
Analyze image                             (birincil; görsel seçilince aktif)
Reads the visual language from a static
image: palette, type direction, shape,
iconography. Estimated, not measured.     (caption)
```

**Anahtar kapısı mimarinin parçasıdır:** Image modu AI enhancement gerektirir. Kapalıysa drop zone %40 soluk, üstünde Notice: "Image analysis needs AI enhancement. Your image goes only to your chosen AI provider." + **Turn on** düğmesi (Settings'e). Website modu anahtarsız çalışmaya devam eder; iki modun bu farkı caption'larda açıkça yazar.

**Image modu, analiz sonrası — eylemler:** Overview'da küçük resim + rozet + etiketin altında iki düğme: **Re-analyze image** (↺ ile önde; aynı görseli yeniden okur) ve **New image** (drop zone'a döner). İkisi de ghost'tur: §1.1 gereği ekranın tek birincil eylemi Export'tur; Re-analyze ağırlıkla değil konum ve simgeyle önde gelir. Küçük resme basmak da **New image** ile aynıdır. Önceki sonuç History'de kalır; yeni dosya seçildiğinde etiket bugünkü gibi sorulur (varsayılan "Image style · <tarih>").

**Image modunda başlık (§3):** ikinci satır **"Image · <etiket>"** ve analiz saatidir ("Analyzed 12:41"; analiz öncesi "Image" + "Not analyzed"). Aktif sekmenin alan adı Image modunda **asla** gösterilmez; sekme değiştirmek başlığı değiştirmez. Website modunda başlık değişmez.

**Image modu, analiz sonrası — sekme başına içerik:**

| Sekme | Website kaynağı | Image kaynağı |
|---|---|---|
| Overview | Sayılar (colors/fonts/comps/**keyframes**) · palet · Snapshot (Theme/Style/Type/Shape/**Motion**/Stack) · Export (Prompt · DESIGN.md · **Skill**) | Küçük resim + **"Estimated from image"** rozeti · sayılar (colors/type direction/**icon style**/mood) · palet · Snapshot (Theme/Style/Type direction/Shape/**Iconography**/Density) · Export (**Prompt · DESIGN.md**; Skill yok) |
| Colors | Ölçülü roller + kontrast | Tahmini roller; her satırda `est.` işareti; kontrast tahmini değerlerden, "estimated" notuyla |
| Type | Aileler + lisans + tam ölçek | Sınıflandırma ve ağırlık karakteri; aile iddiası yok (görselde okunur metin yoksa); önerilen açık fontlar "suggested" etiketiyle |
| Comps | Ölçülü bileşenler + hover farkları | **Shape language + iconography + illustration/texture** profili (stroke/filled, köşe, grid hissi); tümü `est.` |
| Motion | Keyframe/loop/state listeleri | Boş durum: "Motion can't be read from a static image. Analyze the live site to measure it." (çubuk öğesi sabit kalır; içerik durumu açıklar) |
| Settings | değişmez | değişmez; AI enhancement açıklamasına "Required for image analysis." cümlesi eklenir |

**DESIGN.md (image):** frontmatter'a `source-type: image` ve `confidence: estimated`; her bölümde "estimated from image" notu; Motion / Interaction states / Anatomy bölümleri **üretilmez**; Agent instructions: "This is a style direction inferred from an image, not a measured system; treat values as starting points."

**History:** kayıtlar kaynak türüyle işaretlenir (favicon vs küçük resim); imaj yalnız yerelde saklanır, buluta gitmez (sağlayıcı API çağrısı hariç hiçbir yere yüklenmez).

---

## 5. Tipografi ölçeği (panel)

Taban 13px (yan panel; 16 tabanı bu genişlikte fazla). Oran ≈ 1.2. Aile: mevcut UI fontu; mono yalnızca değerler için.

| Stil | Boyut / Ağırlık / Satır | Kullanım | Örnek |
|---|---|---|---|
| `title` | 18 / 600 / 1.2 | Sheet başlıkları, Home'da yok | "Settings" |
| `stat` | 20 / 600 / 1.1 · mono | Summary strip sayıları | "11" |
| `section` | 13 / 600 / 1.3 | Bölüm başlıkları, Export başlığı | "Colors" |
| `body` | 13 / 400 / 1.5 | Açıklamalar, KV değerleri | "A style guide your project keeps." |
| `label` | 11 / 500 / 1.3 · uppercase · +0.06em | Stat tile alt etiketi, tab bar etiketi | "COLORS" |
| `value` | 12 / 400 / 1.4 · mono | Hex, px, dosya adı, meta | "#ed462d", "32.6k chars" |
| `caption` | 11 / 400 / 1.4 · muted | Tek satır yardım, zaman | "Analyzed 12:41" |

Kurallar: mono-uppercase yalnızca `label`'da; bölüm başlıkları sentence case. Bir ekranda en fazla 4 stil yan yana. Başlık ile gövde arasında en az 1.4× boyut farkı (18/13) ya da ağırlık farkı (600/400).

---

## 6. Boşluk sistemi

Taban 4px. Ölçek: 4 · 8 · 12 · 16 · 24 · 32.

| Bağlam | Değer |
|---|---|
| Panel yan kenar | 16 |
| Bölümler arası (stack) | 24 |
| Bölüm içi satırlar (stack) | 8 |
| Kart iç boşluğu (inset) | 12 |
| Kontrol yüksekliği | 36 (birincil düğme 40) |
| Çip yüksekliği | 28 |
| Satır (KV row) yüksekliği | 32 |
| Inline boşluk (ikon–metin) | 8 |

Kural: değerler yalnızca ölçekten; 13px, 27px yok. İlişkili şeyler 8, ilişkisiz şeyler 24.

---

## 7. Token'lar (alias düzeyi)

Mevcut koyu tema korunur; değerler `popup.css`'teki paletten alınır, burada rol adları sabitlenir.

```
--bg                 panel zemini
--surface            kart / sheet
--surface-raised     stat tile, seçili segment
--border             ayırıcılar
--border-subtle      KV satır çizgisi
--text-primary       başlık, değer
--text-secondary     açıklama
--text-muted         caption, label
--accent             birincil düğme, seçili durum (mevcut mor)
--accent-soft        seçili çip zemini (accent %12)
--success / --warning / --danger
--radius-control 8 · --radius-card 12 · --radius-chip 999
--shadow-sheet       sheet için tek gölge
--duration-fast 120ms · --duration-normal 200ms · --ease cubic-bezier(.2,.8,.2,1)
```

Bileşen token'ı sadece gerekince: `--button-primary-bg: var(--accent)`. Ham hex bileşende yazılmaz.

---

## 8. Bileşen envanteri — anlam başına bir bileşen

| Bileşen | Anlam | Kullanıldığı yer | Kullanılmadığı yer |
|---|---|---|---|
| **Button primary** | Ekranın tek birincil eylemi | Analyze page · Export düğmesi | Başka hiçbir yerde |
| **Button secondary / ghost** | İkincil eylem | Sign out · Try again · Change key | — |
| **Segmented control** | Birbirini dışlayan mod | Page/Element · Output | Model, sağlayıcı |
| **Select** | Listeden tek seçim | Provider · Model · Target · Defaults | Filtre |
| **Chip (filter)** | Çoklu / açılır filtre | Focus (Refine) | Mod, seçim |
| **Stat tile** | Sayısal özet | Summary strip | — |
| **Swatch strip** | Renk rolleri | Palette | — |
| **KV row** | Etiket–değer | Snapshot · bölüm satırları · Settings | — |
| **Section** | Sekme içinde başlıklı grup (katlanmaz) | Kategori sekmelerinin alt bölümleri (Contrast, Scale, Transitions…) | Export |
| **Card** | Birincil alanı çerçeveler | Export | Her bloğu çerçevelemek için değil |
| **Notice** | Durum / uyarı, tek satır + eylem | Hata, izin, offline, model dürtmesi | Pazarlama mesajı |
| **Tab bar** | Birincil gezinme, sticky alt çubuk | Overview · Colors · Type · Components · Motion · Settings | Popup |
| **Sheet** | Geçici tam yükseklik yüzey | Preview raw output · History (tam liste) | Settings (o bir sekme) |

---

## 9. UX yazımı

**Sözlük (bunların dışına çıkılmaz):** Analyze page · Pick element · Overview · Colors · Type · Components · Motion · Settings · Output · Prompt · DESIGN.md · Skill · Target · Refine · AI enhancement · API key · Recent · History · Preview.

**Kurallar:** sentence case; düğmeler fiille başlar; her ayar bloğu tek tam cümleyle açıklanır; jargon yok ("RAW capture" yalnız Developer'da); "Paid." gibi parçalar yok; sayı gösterilen her yerde birim var (chars, sections).

**Anahtar metinler:**

| Yer | Metin |
|---|---|
| Home açıklama | Reads colors, type, spacing, components, motion and hover states from this page. |
| Kalan hak (anonim) | 3 of 5 free analyses this month · Sign in for unlimited |
| Sınır doldu | You've used your 5 free analyses this month. |
| Output · Prompt | Rebuild this page in a chat tool. |
| Output · DESIGN.md | A style guide your project keeps. |
| Output · Skill | DESIGN.md + tokens, packaged for coding agents. |
| Export meta | 17 sections · 32.6k chars |
| AI enhancement | Optional. Improves the prompt's direction paragraph. Your key stays in this browser. |
| Model dürtmesi | Newer model available: Sonnet 5 — Switch · Dismiss |
| Sayfa okunamadı | Couldn't read this page. Some sites block extensions; try reloading, or pick an element instead. |
| İzin | VibeDesign needs permission to read rig.ai. |
| Az veri | Very little design data on this page. Try a page with more UI. |
| History boş | Your analyses will appear here. |
| Soluk sekmeye dokunma | Analyze this page first. |
| Image açıklama | Reads the visual language from a static image: palette, type direction, shape, iconography. Estimated, not measured. |
| Image anahtar kapısı | Image analysis needs AI enhancement. Your image goes only to your chosen AI provider. |
| Image rozeti | Estimated from image |
| Motion (image) | Motion can't be read from a static image. Analyze the live site to measure it. |

---

## 10. PROMPT 3 — uygulama (Claude Code'a yapıştır)

```text
PROMPT 3 — Side panel information architecture (implements docs/SIDEPANEL-IA.md)

Branch v3.0. First copy the spec I attach as docs/SIDEPANEL-IA.md and read it fully. Then read lib/ui-helpers.js, sidepanel.html/js, popup.html/js, popup.css and docs/AUDIT-v3.md. Do not touch content.js or prompt-builder.js logic; this is a presentation-layer rebuild.

1. Structure: implement §3–4: a sticky bottom tab bar (Overview · Colors · Type · Components · Motion · Settings; 56px; icon + short label; category tabs dimmed until an analysis exists, tapping a dimmed tab shows the "Analyze this page first" notice), a scrolling content area per tab, and a header with only logo, domain·status and ↺. Overview has two states (before/after analysis). Category tabs are full lists with an "Export ▸" shortcut at the top. Settings is a tab; History lives inside it (last 3 + "See all" sheet). Remove: FULL PAGE / GLOBAL TOKENS tabs, the "N of 5 free prompts" banner, the inline AI provider/model/key block, the version chip from the header, the inline model nudge, the inline Developer section. Everything removed reappears only where §4.3 says.
2. Overview (after analysis): summary strip (counts from lib/design-model.js — never show 0), palette strip (role colours), Snapshot KV list, Export card, Layout block, and "Preview raw output" sheet. Category tabs render full lists from the model (Colors incl. contrast; Type incl. availability + scale; Components incl. hover deltas; Motion incl. measured/recommended states). Every list row and the Snapshot use one KV-row component.
3. Export card: segmented Output (Prompt · DESIGN.md · Skill); one primary button whose label follows the selection; Target select only for Prompt; "Where to put it" collapsible for the other two (one line per tool: Claude Code, Cursor, Codex, Stitch, Antigravity, Gemini CLI, Kiro, Lovable, v0, Bolt, Replit, Claude Design, Figma Make); Focus chips collapsed under "Refine", Prompt-only; meta line "N sections · Nk chars" that updates with Focus.
4. Settings tab exactly as §4.3, including the AI enhancement toggle that hides provider/model/key when off, and the History block. Model discovery, nudge and session status line move here unchanged in behaviour.
5. Typography, spacing and tokens: implement §5–7 as CSS custom properties in popup.css; replace hard-coded sizes/colours in the panel with them. Only `label` may be mono-uppercase.
6. Components (§8): build small reusable renderers in lib/ui-components.js (button, segmented, select, chip, stat tile, swatch strip, kv row, section, card, notice, sheet). No component used for a meaning the table forbids.
7. Copy: use the strings in §9 verbatim; sentence case everywhere; no other copy without a §9 entry — add entries to the spec if you need new strings and tell me.
8. States (§4.5): analyzing progress with stage names and cancel; unreadable page; permission needed (stub the action for Prompt 6); offline/AI skipped; sparse model.
9. Popup: header + segmented + Analyze + "Open side panel"; no tab bar; starting an analysis from the popup opens the side panel and runs there.
10. Keep everything working: Analyze, Pick element, image analysis, sign in/out, history, cloud sync, model discovery, downloads. Tests: DOM-stub render tests for each surface and state, a test that no component is used outside its allowed contexts (grep-level is fine), and snapshot tests of rendered HTML per state. Run, show output, commit in 3–4 readable commits (structure · export card · settings/history · tokens & copy), push.
Report with a plain-language walkthrough and a list of any spec ambiguities you had to resolve.
```

### PROMPT 3d — sınır ve giriş durumu

```text
PROMPT 3d — Remove the monthly cap; make sign-in state visible

1. Keep the anonymous cap (5 analyses per month; signed-in accounts unlimited) — the product rule from 2.0.1 stands. Fix its presentation per spec §3: signed-out users see a caption under the Analyze button "N of 5 free analyses this month · Sign in for unlimited" (the sign-in part is a link that starts the auth flow); at the limit, the Analyze button is replaced by a primary "Sign in for unlimited" button with the sentence "You've used your 5 free analyses this month." above it. No "Try again". The last result and all tabs keep working at the limit. Signed-in users never see the counter. Tests for 4/5, 5/5 and signed-in.
2. Header right: signed in → 24px avatar (initial if no photo); signed out → 28px ghost button "Sign in" that starts the existing auth flow. Both open Settings → Account after. Remove the dot badge on the Settings tab. Any message that asks the user to sign in must be a button that starts the flow, never plain text.
3. Settings → Account shows the email, "Signed in as", session status line, Sign out; signed out shows one sentence "Sign in to keep history on all your devices." + Sign in button.
Commit "fix: remove monthly cap, sign-in state in header", push, report.
```

### PROMPT 3b — ilk tarayıcı testinden çıkan düzeltmeler

```text
PROMPT 3b — Fix the deviations from docs/SIDEPANEL-IA.md found in the first browser test, plus the spec amendments (re-read §3 "Sayfa bağlamı", "AI göstergesi", header/tab bar sizes, §4.5).

Deviations from spec (must match the spec exactly):
1. Tab bar: icon + 11px label on every tab (no icon-only), active = accent + 600 label, dimmed 40% before analysis, ≥48px touch height.
2. Overview after analysis MUST render the summary strip (counts) and the palette strip as the first two elements. They are missing on rig.ai. Find out why (likely counts/roles not read from the model) and add a render test that fails when either is absent for the rig fixture.
3. Remove the floating "Sign in to sync" pill above the header. Account lives in Settings; show a dot badge on the Settings tab when signed out.
4. Header: wordmark 20px tall, domain 13px, status caption. Nothing above or below the header row.
5. Each tab's content starts with an 18px title (Overview, Colors, Type, Components, Motion, Settings).

Spec amendments (new behaviour):
6. Page context: header shows the CURRENT tab's domain; three states per the spec table — Analyze page (primary) / Re-analyze (ghost, labelled, with ↺ icon) / "Showing <old>" notice + "Analyze <current>" primary. Update on tab switch and on navigation; never drop the last result.
7. AI indicator: under the Analyze/Re-analyze button, a caption "AI enhancement: <provider> · <model> · Change" linking to Settings; "AI enhancement off · Turn on" when off. Show the same in the analyzing progress line.

Bugs:
8. Export meta shows "1 sections"; it must count the prompt's ## sections (17 for All on rig). Test it.
9. "Very little design data" fired on rig.ai at 09:02. Reproduce; likely the analysis ran before the page finished loading or on the wrong tab. Gate analysis on document readyState + a settle delay, show "Page is still loading — try again" in that case, and tighten the sparse rule to the spec definition.
10. The analyzing status line streamed raw AI markdown. Show stage names only; never content.
11. Snapshot "Style" value truncates; wrap to two lines under the label.

Run the render and panel tests, show output, commit as one commit "fix: panel spec deviations and page context", push. Then report what I will see on rig.ai, on a second site, and while analyzing.
```

---

## 11. Kabul kontrolü (senin testin)

- **Squint testi:** gözlerini kısınca Home'da tek bir parlak düğme görünmeli; Result'ta iki (Analyze yerine Export düğmesi + sayılar).
- **Yeni kullanıcı testi:** Paneli hiç görmemiş biri 5 saniyede "Analyze page"e basabiliyor mu?
- **Ayar testi:** Ana ekranda anahtar, sağlayıcı, model, geliştirici satırı **hiç** görünmüyor mu?
- **Özet testi:** Analizden sonra kaydırmadan sayıları, paleti ve Export düğmesini görüyor musun?
- **Gezinme testi:** Alt çubukta her sekmenin etiketi var mı; aktif sekme belli mi; içerik kendi içinde kayıyor mu; analiz yokken kategori sekmeleri soluk mu?
- **Sayfa bağlamı testi:** rig.ai'yi analiz et, başka sekmeye geç: header yeni domain'i gösteriyor mu, "Analyze <site>" düğmesi görünüyor mu? Aynı sayfada "Re-analyze" etiketli mi?
- **AI göstergesi testi:** Analyze düğmesinin altında "AI enhancement: Claude · Fable 5 · Change" yazıyor mu?
- **Odak testi:** Refine'da Layout'u seçince meta satırı değişiyor mu ("7 sections · 5.7k chars")?
- **Bileşen testi:** Model seçimi çip mi (yanlış) yoksa select mi (doğru)?
- **Kopya testi:** Ekranda "Paid.", "RAW", "N of 5" geçen bir yer kaldı mı?
