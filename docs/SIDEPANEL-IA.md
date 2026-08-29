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
| **Capture** | domain, favicon, url, capturedAt, scope (page/element), status | content.js |
| **Design model** | theme, styleLine, colors[role], fonts[role+availability], typeScale, spacing, shape, shadows, motion{keyframes, ambient}, states, anatomy, a11y, counts | lib/design-model.js |
| **Output** | kind (prompt / design-md / skill), size, sections, focus (prompt only), target (prompt only) | prompt-builder / design-md-builder / skill-builder |
| **Settings** | account, aiEnhancement{provider, model, keyPresent}, defaults{output, target}, developer | chrome.storage |
| **History item** | Capture + Design model özeti + outputs | storage / cloud |

Kural: bir alan modelde yoksa UI'da da yoktur. UI için yeni veri uydurulmaz.

---

## 3. Bilgi mimarisi — ekranlar ve gezinme

```
Header (sabit, 48px):   [logo]  [domain · durum]                              [↺]

İçerik (kayar):         seçili sekmenin içeriği

Alt sekme çubuğu (sticky, 56px, ikon + kısa etiket):
   Overview · Colors · Type · Components · Motion · Settings
```

- **Tek gezinme düzeyi: alt çubuk.** Mobil uygulama sekmesi gibi sticky; içerik kendi içinde kayar. Header'da gezinme yok (yalnız yeniden analiz).
- **Durum, sekmeleri etkiler.** Analiz yokken Overview "Home" içeriğini gösterir (Analyze düğmesi + Recent); kategori sekmeleri soluktur, dokununca "Analyze this page first" notice'ı. Analiz gelince kategoriler açılır.
- **Overview = özet + Export.** Kategori sekmeleri = tam listeler ("See all" katlaması gerekmez); her kategori sekmesinin üstünde küçük bir "Export ▸" kısayolu Overview'daki karta götürür.
- **Settings bir sekmedir**, sheet değil. Account, AI enhancement, Defaults, History, Developer, About onun içinde.
- **Sheet yalnızca geçici yüzeyler için:** "Preview raw output" ve History'nin uzun listesi.
- **Popup = Overview'un kısa hâli.** Popup'ta yalnızca header + Page/Element + Analyze + "Open side panel"; alt çubuk popup'ta yok. Analiz popup'tan başlatılırsa yan panel açılır.

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
- Summary strip sayıları modelden gelir; sayı yoksa tile çizilmez (0 gösterilmez).
- Export kartı **tek** birincil düğme içerir; etiketi output'a göre değişir: *Copy prompt* / *Download DESIGN.md* / *Download Skill*.
- Output açıklamaları sabittir: Prompt → "Rebuild this page in a chat tool." · DESIGN.md → "A style guide your project keeps." · Skill → "DESIGN.md + tokens, packaged for coding agents."
- Target seçici yalnızca Prompt'ta görünür. DESIGN.md ve Skill'de yerine "Where to put it ▸" katlı satırı gelir (araç başına 1 satır).
- Focus çipleri "Refine" altında katlıdır; açılınca seçim Export meta satırına yansır ("Layout · 7 sections · 5.7k chars").
- Overview kategori içeriğini tekrar etmez; kategoriler alt çubuktan açılır ve tam listedir. Her liste tek tip satır kullanır (KV row).
- "Preview raw output" tam metni monospace bir alanda açar; Copy düğmesi orada da vardır.

### 4.3 Settings (sekme)

```
Settings
─────────────────────────────────────────────
Account
  slnsenturk@gmail.com                 Sign out
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
  VibeDesign 3.0.0 · Privacy · Support
```

Kurallar: AI enhancement kapalıyken sağlayıcı/model/anahtar satırları gizlidir. "Paid. Get key →" gibi parçalı metinler yok; her bloğun altında tek tam cümle.

### 4.4 History (Settings içinde; uzun liste sheet)

Settings'te son 3; "See all" tam listeyi sheet olarak açar: favicon · domain · zaman · tema/renk sayısı. Satıra dokununca Overview o analizle dolar. Sağ üstte "Clear". Giriş yapılmamışsa altta tek satır: "Sign in to keep history on all your devices."

### 4.5 Durumlar

| Durum | Ne görünür |
|---|---|
| Analiz sürüyor | Analyze düğmesi ilerleme çubuğuna dönüşür: "Reading page… 2/6" (aşama adları: Reading · Colors · Type · Components · Motion · Building). İptal linki. |
| Sayfa okunamadı | Notice (uyarı): "Couldn't read this page. Some sites block extensions; try reloading, or pick an element instead." + "Try again". |
| İzin gerekiyor | Notice: "VibeDesign needs permission to read rig.ai." + "Allow" (Prompt 6 akışı). |
| Çevrimdışı / AI hatası | Sonuç yine gelir (kural motoru yereldir); Export meta satırında "AI enhancement skipped — offline". |
| Boş model (çok az veri) | Summary strip yerine tek satır: "Very little design data on this page. Try a page with more UI." |

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

---

## 11. Kabul kontrolü (senin testin)

- **Squint testi:** gözlerini kısınca Home'da tek bir parlak düğme görünmeli; Result'ta iki (Analyze yerine Export düğmesi + sayılar).
- **Yeni kullanıcı testi:** Paneli hiç görmemiş biri 5 saniyede "Analyze page"e basabiliyor mu?
- **Ayar testi:** Ana ekranda anahtar, sağlayıcı, model, geliştirici satırı **hiç** görünmüyor mu?
- **Özet testi:** Analizden sonra kaydırmadan sayıları, paleti ve Export düğmesini görüyor musun?
- **Gezinme testi:** Alt çubuk her sekmede sabit mi; içerik kendi içinde kayıyor mu; analiz yokken kategori sekmeleri soluk mu?
- **Odak testi:** Refine'da Layout'u seçince meta satırı değişiyor mu ("7 sections · 5.7k chars")?
- **Bileşen testi:** Model seçimi çip mi (yanlış) yoksa select mi (doğru)?
- **Kopya testi:** Ekranda "Paid.", "RAW", "N of 5" geçen bir yer kaldı mı?
