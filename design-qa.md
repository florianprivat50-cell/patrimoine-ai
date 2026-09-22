# Accueil mobile — 19 septembre 2026

final result: passed

## Scope and visual truth
- User request: add a welcome page inspired by the supplied video before the existing login, not a literal clone of DailyFlutterUI or a redesign of the analysis workspace.
- Source: `/workspace/scratch/ab3c5194fe55/upload/ScreenRecording_09-19-2026 13-06-28_1.mp4`, 512 × 1112, 7.13 seconds. Dark logo introduction followed by a light, tilted-screen collage, serif title and dark entry CTA.
- Source normalization: frame at 6 seconds, inner app region cropped at 49,244 (240 × 535), normalized to 390 × 844. TikTok and simulator chrome are excluded; the residual device rim is not an app requirement.
- Implementation: `http://terminal.local:4173/mobile/`, rendered in cloud Chrome through `/tests/welcome-preview.html` at 390 × 844 CSS px, density 1. Full screenshot 1363 × 936; inner viewport crop 390 × 844.
- Screenshot: `/workspace/scratch/pia-welcome-final-mobile.jpg`.
- Side-by-side comparison: `/tmp/pia-comparison.png` (780 × 844). Both images opened together. All typography and CTA detail were legible at this size; no extra detail crop was needed.

## Findings and iteration
- Initial P2: the decorative area used 53svh, pushing the final disclosure beneath the mobile viewport. Evidence: `/workspace/scratch/pia-welcome-qa.jpg`. Reduced tall-mobile image area to 45svh. Reloaded and captured `/workspace/scratch/pia-welcome-final-mobile.jpg`: CTA, registration and disclosure fit within the 844px viewport. No outstanding P0/P1/P2 findings.
- Typography: editorial Georgia serif with italic second line mirrors the reference hierarchy; existing sans-serif for controls. French copy is intentionally two lines rather than a copied English title. Readable 15–16px body/CTA, small nonessential caption.
- Layout: diagonal three-column montage, large upper visual region, clear copy block and full-width CTA. Header and registration entry are intentional product additions. Desktop uses a split-screen variant; analysis layout stays unchanged.
- Colors: dark navy introduction/button, white paper surface and restrained green accent preserve Patrimoine's existing palette. No invented performance or security claim.
- Images: real screenshots of the application's fictitious demonstration result and financing form, converted to WebP. Existing product logo reused. No generated fake dashboards, customer data or device chrome.
- Content: welcome → login and welcome → signup reuse the existing account implementation; no new account store, database or finance calculation.

## Verification
- Tested primary CTA to login, return to welcome, registration CTA to existing signup.
- Checked 360/390/430/768/1280px widths: no horizontal overflow or broken images. Mobile recapture after correction: 390px viewport and scrollWidth 390px.
- Intro automatically ends after 1.5 seconds, only once per session; keyboard/pointer dismiss it; reduced-motion CSS disables it. Verified by code review; no iPhone device animation test claimed.
- Existing signed-in users, demo, recovery and invite bypass welcome by state. Existing tokens are never rewritten. These branches are code-reviewed, not real-account-tested this turn.
- Browser console checked: logged errors originate from the browser extension, not application code. Vite local preview does not provide real Netlify authentication endpoints; no sign-in request was submitted during visual QA.
- Existing 18 automated account/analysis tests passed. Production build passed.

## Follow-up polish
- P3: montage has fewer unique screens than the reference, intentionally limited to two real product screens. The reference fade is replaced by a clean paper edge.
- Real account confirmation and inter-device persistence remain a separate acceptance test, unchanged by this presentation-only work.
