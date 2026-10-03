# **Plugins**

<p>
<img alt="Total number of available plugins" src="https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/total.svg">
<img alt="Open plugin requests" src="https://img.shields.io/github/issues/lnreader/lnreader-plugins/plugin%20request?color=success&label=plugin%20requests">
<img alt="Open bug reports" src="https://img.shields.io/github/issues/lnreader/lnreader-plugins/bug?color=red&label=bugs">
</p>

Community-driven plugin repository for [LNReader](https://github.com/LNReader/lnreader). This repository hosts plugins and manages related issues and requests.

<!-- SOURCE_HEALTH:START -->

## 📡 Source health

Live check of every `english` plugin against its real site, run daily by
[`.github/workflows/source-health.yml`](./.github/workflows/source-health.yml).

Each plugin is exercised the way the app uses it: **popular → search → novel
→ chapter**. A plugin only counts as healthy if all four return real data.

**63 checked** · ✅ 27 passing · ❌ 9 failing · ❔ 27 undetermined

Last run: `2026-10-03 17:45 UTC`. This is a committed snapshot, not a live badge —
a row reflects the site at that moment and can change without this page being
edited.

**Read the three states carefully.**

- ✅ **PASS** — all four checks returned real data from a live request.
- ❌ **FAIL** — the checks ran and the plugin is broken. This is a real
  defect worth an issue or a pull request.
- ❔ **UNKNOWN** — the runner never got through, so the plugin's health
  was not determined. This is **not** a verdict on the plugin. GitHub Actions
  runners are datacentre IPs; large novel sites block or challenge them by
  policy. Plenty of sources in this state work normally in the app on a phone,
  and the app resolves some of them with its own Cloudflare handling. Treat
  UNKNOWN as "not measured", never as "broken".

| Source | Site | Health | Detail |
| --- | --- | :---: | --- |
| **Baka-Tsuki** | https://www.baka-tsuki.org/project/ | ✅ PASS | 2 chapters, 254198 chars |
| **Beast Novels** | https://beastnovels.com/ | ✅ PASS | 160 chapters, 17700 chars |
| **Dreamy Translations** | https://dreamy-translations.com | ✅ PASS | 241 chapters, 10223 chars |
| **Faq Wiki** | https://faqwiki.xyz | ✅ PASS | 402 chapters, 14317 chars |
| **Firebird's Nest** | https://firebirdsnest.org | ✅ PASS | 3 chapters, 9181 chars |
| **FuckNovelpia** | https://fucknovelpia.com/ | ✅ PASS | 69 chapters, 207 chars |
| **iNovelTranslation** | https://inoveltranslation.com | ✅ PASS | 10 chapters, 12601 chars |
| **Konkon** | https://konkon.ink | ✅ PASS | 100 chapters, 15094 chars |
| **LeafStudio** | https://leafstudio.site/ | ✅ PASS | 2 chapters, 16568 chars |
| **Light Novel Translations** | https://lightnovelstranslations.com/ | ✅ PASS | 94 chapters, 9626 chars |
| **LnMTL** | https://lnmtl.com/ | ✅ PASS | 100 chapters, 14323 chars |
| **LNORI** | https://lnori.com/ | ✅ PASS | 305 chapters, 336 chars |
| **MVLEMPYR** | https://www.mvlempyr.io/ | ✅ PASS | 839 chapters, 6979 chars |
| **Novel Archive** | https://novelarchive.cc | ✅ PASS | 3202 chapters, 11017 chars |
| **Novel7s** | https://novel7s.com | ✅ PASS | 70 chapters, 12123 chars |
| **NovelDex** | https://noveldex.io | ✅ PASS | 301 chapters, 7452 chars |
| **NovelHi** | https://novelhi.com/ | ✅ PASS | 7464 chapters, 4406 chars |
| **NovelRest** | https://novelrest.vercel.app | ✅ PASS | 12 chapters, 563 chars |
| **Peach Puff Translations** | https://peachpuff.in/ | ✅ PASS | 114 chapters, 29998 chars |
| **Puffin Folio** | https://www.puffinfolio.com/ | ✅ PASS | 68 chapters, 12408 chars |
| **Read From Net** | https://readfrom.net/ | ✅ PASS | 17 chapters, 26953 chars |
| **ReChapters** | https://www.rechapters.com | ✅ PASS | 1432 chapters, 10255 chars |
| **Royal Road** | https://www.royalroad.com/ | ✅ PASS | 109 chapters, 54606 chars |
| **We Tried TLS** | https://wetriedtls.com | ✅ PASS | 892 chapters, 10750 chars |
| **Web Novel Translation** | https://wntl.net/ | ✅ PASS | 556 chapters, 3689 chars |
| **Witch Cult Translations** | https://witchculttranslation.com | ✅ PASS | 450 chapters, 30477 chars |
| **Wuxia World** | https://www.wuxiaworld.com/ | ✅ PASS | 357 chapters, 8351 chars |
| **Archive Of Our Own** | https://archiveofourown.org/ | ❌ FAIL | Returned no novels |
| **Chrysanthemum Garden** | https://chrysanthemumgarden.com | ❌ FAIL | Returned no novels |
| **Crimson Scrolls** | https://crimsonscrolls.net | ❌ FAIL | Returned no novels |
| **Divine Dao Library** | https://www.divinedaolibrary.com/ | ❌ FAIL | Returned no novels |
| **Genesis** | https://genesistudio.com | ❌ FAIL | Cannot read properties of undefined (reading 'chapter_content') |
| **LightNovelWorld** | https://lightnovelworld.org/ | ❌ FAIL | Returned no novels |
| **NovelBuddy** | https://novelbuddy.me/ | ❌ FAIL | Cannot read properties of undefined (reading 'items') |
| **Skythewood Translations** | https://skythewood.blogspot.com | ❌ FAIL | Missing novel name |
| **WTR-LAB** | https://wtr-lab.com/ | ❌ FAIL | None of the requested translations could be loaded [NOT signed in (get-session HTTP 200: null)]. The server returned no usable response. |
| **Anime Anyway** | https://animeanyway.com/ | ❔ UNKNOWN | HTTP 429 |
| **Asianfanfics** | https://www.asianfanfics.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Chikari** | https://chikari.moe | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **DaoTekno** | https://daotekno.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Dragonholic** | https://dragonholictranslations.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Dream Big Translations** | https://www.dreambigtl.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Empire Novel** | https://www.empirenovel.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Fenrir Realm** | https://fenrirealm.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Fiction Zone** | https://fictionzone.net | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Foxteller** | https://www.foxteller.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **HangulPlanet** | https://hangulplanet.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Indra Translations** | https://indratranslations.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Inkitt** | https://www.inkitt.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Mynovels** | https://mynovels.su/ | ❔ UNKNOWN | 403 Cloudflare edge challenge (bot rule) |
| **Novel Arrow** | https://novelarrow.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Novel Hall** | https://novelhall.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Novel Updates** | https://www.novelupdates.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Novelight** | https://novelight.net/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **NovelPing** | https://novelping.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **novelsOnline** | https://novelsonline.org | ❔ UNKNOWN | HTTP 522 |
| **PawRead** | https://m.pawread.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Rainofsnow** | https://rainofsnow.com/ | ❔ UNKNOWN | fetch failed |
| **Re:Library** | https://re-library.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **Scribble Hub** | https://www.scribblehub.com/ | ❔ UNKNOWN | 403 Cloudflare edge challenge (bot rule) |
| **StorySeedling** | https://storyseedling.com/ | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |
| **VyNovel** | https://vynovel.com | ❔ UNKNOWN | Network error (ETIMEDOUT) |
| **Webnovel** | https://www.webnovel.com | ❔ UNKNOWN | 403 blocked by Cloudflare (cf-mitigated: challenge) |

Not listed: 5 marked `.broken.ts` (deliberately unshipped).

Reproduce a single row locally:

```bash
npm run check:plugin -- plugins/english/ao3.ts
```

<!-- SOURCE_HEALTH:END -->

## Quick Start

**Prerequisites:** Node.js >= 22

```bash
npm install
npm run dev:start
```

## Documentation

- **[Quick Start Guide](./docs/quickstart.md)** - Create your first plugin
- **[Plugin Development](./docs/docs.md)** - Complete API reference
- **[Testing Guide](./docs/website-tutorial.md)** - Test plugins using the web interface
- **[Live Check](./docs/testing.md)** - Required `npm run check:plugin` check before opening a PR
- **[Komga Plugin](./docs/komga-plugin.md)** - Self-hosted server integration

## Testing Methods

### Web Interface

```bash
npm run dev:start
```

Open [localhost:3000](http://localhost:3000) to test plugins interactively. See the [testing guide](./docs/website-tutorial.md) for details.

### Mobile App

**From GitHub (Automated):**

Push your changes to the `master` branch. The [GitHub Action](./.github/workflows/publish-plugins.yml) automatically builds and publishes plugins to the `plugins` branch.

Add your repository URL to the app:

```
https://raw.githubusercontent.com/<username>/<repo>/plugins/<tag>/.dist/plugins.min.json
```

**From Localhost:**

```bash
npm run serve:dev
```

Add `http://10.0.2.2/.dist/plugins.min.json` (Android emulator) to the app. Requires `.env` configuration (see `.env.template`).

## Disclaimer

The developers are not affiliated with any content providers. If you are a non-aggregator website owner, you may request plugin removal via [Discord](https://discord.gg/QdcWN4MD63) or by [creating an issue](https://github.com/LNReader/lnreader-plugins/issues/new). Removed sites are added to the [blacklist](BLACKLIST.json).
