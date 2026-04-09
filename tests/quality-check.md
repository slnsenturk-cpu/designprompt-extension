# VibeDesign Prompt Quality Checklist
Run before every PR or major change.

## A. Basic Accuracy
- [ ] Color tokens are close to real site colors
- [ ] Font name is correct, or flagged with "appears to be"
- [ ] Dark/light mode is correctly detected

## B. Lottie/Rive Dedup
- [ ] lottiefiles.com: "Lottie animation" appears only once in the prompt
- [ ] Console: Lottie count === 1

## C. Extraction Side Effect
- [ ] Analyze rollups.com → page stays on the first tab
- [ ] Analyze again → same prompt is produced

## D. Focus Consistency
- [ ] Analyze with Gemini → click Colors chip → AI direction is still present in the prompt

## E. Popup / Sidepanel Consistency
- [ ] Analyze the same URL in popup and in sidepanel → prompts match in structure and values

## F. Contradiction Rate
- [ ] No more than one "H1" line in the prompt
- [ ] "dark" and "light" are not both used to describe the same background
- [ ] Same hex color does not appear with two different roles

## G. Confidence Accuracy
- [ ] Site with few CSS vars → `Color confidence: low` warning appears
- [ ] linear.app → no `Color confidence: low` warning (it uses CSS vars)

## H. Token Budget
- [ ] No URL produces a `[truncated]` marker
- [ ] lottiefiles.com: prompt is under 160 lines

## I. Animation Extraction Quality
- [ ] Keyframes are full CSS blocks (not truncated to 150 chars)
- [ ] Per-section animation bindings exist (element → animation mapping)
- [ ] Motion System CSS block contains `.reveal-on-scroll` pattern when scroll animations detected
- [ ] Interaction Paradigm section is preserved in trimmed output (not cut by priority budget)
- [ ] AOS sections show stagger delays with element bindings
- [ ] GSAP ScrollTrigger sites show pin/scrub data with timeline children
- [ ] V0/Lovable output includes `@layer base` CSS override block with HSL values
- [ ] Dark mode sites include explicit "DARK-MODE-ONLY" warning for V0

## J. New Detector Coverage
- [ ] parallaxLayers detected on sites with background-attachment:fixed
- [ ] numberCounters detected on sites with animated stat sections
- [ ] svgPathDrawing detected on sites with stroke-dasharray animations
- [ ] spline3D detected on sites with <spline-viewer> embeds
- [ ] particleSystems detected on sites with tsparticles/particles.js
- [ ] scrollSnap detected on sites with scroll-snap-type containers

---

Acceptance: all A–E items checked. F–H: 75%+.

---

## Console Quick-Check Snippet
Run in `chrome://extensions` → extension → service worker console after each test:

```javascript
chrome.storage.local.get(['promptHistory'], (data) => {
  const latest = Object.values(data.promptHistory || {})
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  if (!latest) return console.log('No prompts yet');

  const p = latest.prompt;
  console.table({
    'Lines':                  p.split('\n').length,
    'Lottie count':           (p.match(/Lottie animation/gi) || []).length,
    'CRITICAL count':         (p.match(/CRITICAL/gi) || []).length,
    'Has confidence warning': p.includes('Color confidence: low'),
    'Has truncation marker':  p.includes('[truncated'),
  });
  console.log('URL:', latest.url);
});
```
