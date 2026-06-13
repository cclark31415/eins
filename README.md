# Eins

A free, browser-based card game **loosely based on Crazy Eights**. One
human plays against three bots; race to 500 points across multiple rounds.

Live at **https://eins.chrisclark.net/**.

## Features

- 114-card deck: 4 colors × (0, −1, two each of 1–9, two each of Skip /
  Reverse / Draw Two), plus 4 Wild, 4 Wild Draw Four, and 2 Wild Draw Six.
  The **−1 card** (one per color) is a chain card — play another card on top
  of it on the same turn.
- Three bot opponents, each randomly assigned an offensive or defensive
  strategy at the start of the tournament. Bots only see their own hand.
- Multicultural bot names rolled at the start of each tournament (🤖 Aiko,
  🤖 Diego, 🤖 Aoife, etc.) — drawn from a ~75-name pool with Latin-script
  spellings only.
- **Eins / Challenge** mechanic
  - Press **Eins!** before playing your second-to-last card.
  - Forget, and any other player can press **Challenge** for a six-card
    penalty.
  - Bad challenges (the previous player called Eins or has more than one
    card) cost the challenger six cards **and** their next turn.
  - Bots think for 2 seconds before each play — that's the window during
    which the human can race a bot to a missed-Eins challenge.
- **Tournament scoring**: number cards = face value; Skip / Reverse /
  Draw Two / −1 = 20 each; Wild / Wild Draw Four / Wild Draw Six = 50
  each. First to 500 wins.
- **Rotation**: starting player is randomly chosen for the first round of a
  tournament; each subsequent round rotates one seat clockwise.
- **Reverse cards** only flip play direction when actually played by a
  player — the opening flip never reverses direction.
- **Polygon shapes** for number cards 3 – 9 (triangle, diamond, pentagon,
  hexagon, heptagon, octagon, nonagon) drawn via CSS `clip-path`.
- **Card-flight animations** on plays and draws; per-action toasts on Skip,
  Reverse, Draw 2, Draw 4.
- **Prominent active color** indicator + a clockwise/counter-clockwise arrow
  in the center of the table.
- **Running play log** under your hand, newest entry on top, with rich
  entries like "🤖 Nia played a Wild Draw Four (blue) on 🤖 Bob."
- Mobile responsive.
- **SEO**: rich meta tags, Open Graph + Twitter cards, JSON-LD (Game,
  WebApplication, WebSite, FAQPage, BreadcrumbList), `manifest.json`,
  `robots.txt`, `sitemap.xml`, OG-image.

## Project layout

```
eins/
├── app.py                # Flask entry point (loads version.json into template)
├── version.json          # version + UTC build timestamp
├── requirements.txt
├── Procfile              # gunicorn for Azure / Heroku-style deploy
├── design.md             # Original / running design doc & rules
├── README.md
├── .github/
│   └── workflows/
│       └── azure-deploy.yml   # CI / CD pipeline
├── static/
│   ├── eins.css
│   ├── eins.js           # Game engine, bot AI, UI, animations
│   ├── icon.svg          # Favicon / PWA icon
│   ├── og-image.svg      # Open Graph share image
│   ├── manifest.json     # PWA manifest
│   ├── robots.txt
│   └── sitemap.xml
└── templates/
    └── index.html
```

## Running locally

Requires Python 3.10+.

```bash
git clone git@github.com:cclark31415/eins.git
cd eins

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python app.py
```

Then open **http://127.0.0.1:5000/** in a browser. Override the port with
`PORT=5050 python app.py`.

To run with gunicorn (production-style):

```bash
.venv/bin/pip install gunicorn
.venv/bin/gunicorn -b 0.0.0.0:5000 app:app
```

## Endpoints

| Path             | Description                                    |
|------------------|------------------------------------------------|
| `/`              | Game page                                      |
| `/health`        | Health check (`{"status": "healthy"}`)         |
| `/robots.txt`    | Crawler directives                             |
| `/sitemap.xml`   | XML sitemap                                    |
| `/manifest.json` | PWA manifest                                   |
| `/static/...`    | CSS, JS, SVG icons, OG image                   |

## Versioning

[`version.json`](version.json) holds the public version label and a UTC
build timestamp (rendered in the page footer). `app.py` reads it on startup
and injects both into the index template.

The CI pipeline auto-stamps `buildTime` to deploy time on every push to
`main`, so the footer always reflects when the running build was deployed.
You only need to bump `version` manually when you want to mark a release.

---

## Deployment

Pushes to `main` build and deploy to Azure App Service via GitHub Actions
([.github/workflows/azure-deploy.yml](.github/workflows/azure-deploy.yml));
the workflow stamps the build time and deploys the runtime files with
`azure/webapps-deploy@v3`.

> The one-time Azure provisioning steps (resource group, App Service plan,
> web app, custom domain + managed TLS, and the GitHub publish-profile secret)
> are kept in a private repository.

---

## Updating the chrisclark.net landing page

The Eins entry on the chrisclark.net landing page lives in the sibling
project [`chrisclark-net/`](../chrisclark-net/). After this Eins repo is
deployed, deploy the landing page from its own repo (the change is in
`templates/index.html` — look for the `Eins` `app-card`).

---

## Game rules summary

1. On your turn, play a card matching the top of the discard pile by color
   or number/symbol. Wilds are always playable.
2. If you have no playable card, click the draw pile. The drawn card may
   be played if it's playable; otherwise your turn ends.
3. Action cards: **Skip** = next player loses turn; **Reverse** = direction
   flips; **Draw Two** = next player draws 2 and is skipped; **Wild** =
   pick a color; **Wild Draw Four** = pick a color, next player draws 4 and
   is skipped.
4. When you have two cards and are about to play your penultimate card,
   press **Eins!**. Forget, and any other player can press **Challenge**
   (six-card penalty). Bad challenges cost the challenger six cards and
   their next turn.
5. The first to discard their last card wins the round and collects points
   from the other players' remaining cards. First to 500 wins the
   tournament.

## Changelog

| Version | Highlights |
|---------|-----------|
| 0.8.0   | Challenge button arms regardless of seat (race bots during their pause); bad challenge = 6 cards + lose turn (queued via `skipNextTurn`). |
| 0.7.x   | Center direction icon; play log under hand (newest first); 2 s pre-turn pause for bots only; richer log entries with target player. |
| 0.6.x   | Major SEO pass — JSON-LD `@graph` (Game / WebApplication / WebSite / FAQPage / BreadcrumbList), Open Graph + Twitter card meta with og-image, `manifest.json`, `robots.txt`, `sitemap.xml`, visible "How to play" content, `<noscript>` fallback. |
| 0.5.x   | Random multicultural bot names with 🤖 emoji; Eins button enabled whenever you currently have 2 cards. |
| 0.4.x   | Per-N polygon shapes for number cards 3 – 9; prominent active-color pill below the piles. |
| 0.3.x   | Tournament scoring (number = face, action = 20, wild = 50, first to 500); cross-round score tracking; round-end modal; card-flight animations; SEO baseline; version footer. |
| 0.2.x   | Action toasts (Skip / Reverse / +2 / +4); active-player border; Eins call mechanic + Challenge button. |
| 0.1.x   | Initial Flask app with 108-card deck, three bots (offensive / defensive), reshuffle, color picker, opening-flip rules. |

## License

Personal project; no license declared. Ask before reusing.
