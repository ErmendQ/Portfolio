# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: recruiters and talent people at game studios, usually on a phone, often arriving from LinkedIn. They skim; within a minute they decide whether Erik is worth forwarding or contacting. Leads and reviewers who open case studies are a secondary audience the depth still has to serve.

## Product Purpose

The personal portfolio of Erik Thomas, game designer / gameplay programmer in Budapest (erikthomas.dev). It shows who he is, what he builds (gameplay systems in Unreal: inventory, combat, AI, multiplayer, interaction) and the projects that prove it. Success is the visitor emailing him at erikthom.dev@proton.me.

## Positioning

A gameplay programmer's portfolio that behaves like the thing he makes: the site is meant to feel like an in-game character menu, with his profile as the character, his skills as the skill tree and his projects as the inventory. Each project opens into a case study that breaks down the systems he built, with captured clips, screenshots and the actual Blueprint graphs viewable in the browser (blueprint-viewer/).

## Operating Context

- Hosted as static files on GitHub Pages under the custom domain erikthomas.dev; no build step. Published site must stay under GitHub Pages' 1 GB limit.
- Bilingual: English and Hungarian, switchable at runtime; Hungarian copy lives beside the English in site/data.js.
- Visitors arrive on phones (iOS Safari, Android Chrome, Samsung Internet) as well as desktop browsers; media must play on all of them.
- Content is edited by hand in site/data.js; media go into assets/ and are converted by tools/optimize-media.py into assets/web/.

## Capabilities and Constraints

- Case studies per project: YouTube gameplay video, meta (role, team, engine, duration), what I built, and a systems breakdown with media galleries (screenshots and clips), a big-screen viewer and an embedded Blueprint viewer.
- Windows build downloads for some projects (Proton Drive links); itch.io, GitHub, LinkedIn links; CV PDF in EN and HU.
- A feedback form posts to a Google Apps Script endpoint; there is no other backend.
- Projects without a cover yet are shown as locked, upload-in-progress slots.

## Brand Commitments

- The site should feel like an in-game character menu (confirmed by Erik). Its vocabulary (status, skills, inventory, slots) and small game rituals belong to the identity.
- Clean, modern design with a dark green nature aesthetic is part of Erik's identity (confirmed by Erik).
- CLAUDE.md names assets/reference-ios26-glass.png, Erik's iOS 26 home screen, as the canonical visual reference: liquid-glass surfaces, generously rounded corners, pine green and grey against a dark leafy backdrop.
- Name: Erik Thomas. Role line: Game Designer / Gameplay Programmer.

## Evidence on Hand

- Seven projects with covers and case studies (Faceless, Bar Fight, Sim-Break, Slenderman AI, Sam's Journey, Procedural City Generator, Dream Up); six more slots are placeholders with no copy yet (CargoVR, FPS Pistol Pack, My Terrarium, Untitled FPS, Haunted, Save the Century).
- Real gameplay clips, screenshots and .uasset Blueprint files in assets/ and blueprint-viewer/assets/; YouTube videos per project; portrait photo (assets/portrait.jpg).
- No testimonials, employers, awards or shipped commercial titles are on hand; do not invent them. Most projects are school or solo projects and are labelled as such.

## Product Principles

- A recruiter on a phone must know who Erik is, what he does and how to email him from the first screen.
- Show the work doing its job: clips and systems over adjectives.
- Every project claim traces to real content in site/data.js; nothing is embellished.
- The character-menu feel is carried by structure and small rituals, never at the cost of speed or clarity.
- Works identically well on iPhone, Android and desktop; no feature depends on one browser.

## Accessibility & Inclusion

No product-specific requirement was established beyond keyboard access, readable contrast on the dark ground, and respecting reduced-motion preferences.
