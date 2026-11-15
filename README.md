# Combustion Atlas

**An AI-assisted dashboard that ranks and explains NASA's microgravity combustion investigations by how much they matter for fire safety where crews live.**

Built for the NASA Physical Sciences Informatics (PSI) challenge: summarize, rank and interpret PSI combustion research to inform fire safety for spacecraft, space stations, lunar and Martian bases, pressurized rovers and spacesuits, and fire safety back on Earth.

Audience: professors, graduate and undergraduate students, aerospace researchers and aerospace engineers. Each role gets its own guide and depending on the role, functionality of the dashboard changes minimally. 

---

## The data

- **Source:** NASA PSI combustion investigation search, 26 records read on 15 Nov 2026: **20 flight investigations** (ISS, Cygnus, Space Shuttle) and **6 ground studies** that reuse flight data.
- **Curated per investigation:** objective, fire-safety takeaway, fuels, sample or burner size, O₂ concentration, pressure, airflow, what was varied, what was held constant, sensors and measurements, team, related investigations, Earth benefit, and a link to the PSI record.
- **Hardware families**, as grouped in the brief:
  - **ACME in the Combustion Integrated Rack (CIR):** BRE, CFI-G, Flame Design, s-Flame, CLD Flame, E-FIELD (gaseous flames)
  - **MDCA in the CIR:** FLEX, FLEX-2, CFI (burning droplets)
  - **MSG flow duct built for SPICE:** BASS, BASS-II, SPICE, SLICE (solid and gaseous fuels)
  - **Saffire on Cygnus:** Saffire-I, II, III (large-scale spacecraft fires)
  - **Smoke & aerosol:** SAME, SAME-R, DAFT/DAFT-2 (one instrument used for both smoke and dust)
- **Honest gaps:** values a PSI record does not state are shown as "not in summary" and drawn dashed, never guessed.

## How investigations are ranked

Each investigation is rated 0–1 on six dimensions. The relevance score (0–100) is a weighted average, and **the weights change with the crew environment you choose**:

| Dimension | Captures | Rated highest for |
| --- | --- | --- |
| Material flammability | Whether materials burn and spread | BRE, BASS-II, Saffire |
| Detection | Smoke, particles, sensor response | SAME, SAME-R |
| Suppression & extinction | Suppressants, extinction limits | FLEX |
| Elevated O₂ / low pressure | Exploration-atmosphere relevance | BRE, CFI-G |
| Scale realism | How realistic the fire is | Saffire |
| Model-validation data | Benchmarks for simulations | CLD Flame, s-Flame, FLEX-2 |

| Crew environment | Pressure | O₂ | Weighs most |
| --- | --- | --- | --- |
| Spacecraft / ISS | 14.7 psia | 21% | Flammability, detection, suppression, scale |
| Lunar base | 10.2 psia | 30% | Elevated O₂, flammability |
| Pressurized rover | 10.2 psia | 30% | Elevated O₂, detection, suppression |
| Mars base (assumed) | 10.2 psia | 30% | Flammability, elevated O₂, suppression |
| Spacesuit | 4.3 psia | 100% | Elevated O₂ |
| Earth applications | 14.7 psia | 20.9% | Detection, suppression |

The ratings are an editorial judgement, and users can re-weight them live with six sliders.

---

## Features

### Explore
- **3D constellation:** every investigation is a star orbiting a ring for its hardware family. Star size and glow show relevance; beams point from a central "habitat" to the top five. Lines link related studies, and small moons are ground studies that reused flight data.
- **Controls:** drag or swipe to rotate, scroll or pinch to zoom, click or tap a star to select it. The view slowly auto-rotates when idle.
- **Role picker ("I am"):** changes the guide's persona, its guided route, suggested questions and (for students and professors) glossary hover-terms.
- **Habitat picker ("Protecting"):** re-ranks everything and updates every chart, card and insight for that atmosphere.

### Rank and filter
- Top three on screen; the full list of 20 in a drawer with a bar per investigation showing which dimensions drive its score.
- Filter by fuel phase: gas, liquid, solid, smoke and aerosol.
- **Tune the ranking:** six sliders re-rank live; one click resets to the habitat's weights.

### Understand one investigation
- **Card:** relevance score, fire-safety takeaway, and an **O₂ coverage pill** (green: tested at or above the habitat's O₂; amber: close; red: short), plus whether the habitat's pressure was tested.
- **Animated specimen view:** a schematic of the experiment itself: spherical and cool flames, a droplet burning down by the d² law, coflow jet flames, electric-field flames, a flat burner that keeps burning in elevated O₂, a flame front spreading over fabric, smoke particles growing, dust aerosol.
- **Full dossier:** objective, fuels, sample size, O₂, pressure, flow, team, **what was varied vs held constant**, sensors, a radar chart of why it ranks where it does, connected studies, and the PSI link. The full dossier can be collapsed to allow more space on the dashboard.

### Compare
- **Pin up to three** investigations. Each pinned star gets a small astronaut standing on it with a flag and shadow.
- **Comparison bench:** side-by-side hardware, fuels, sample, O₂, pressure, flow, variables and sensors. Identical cells are shaded; terms shared by some are highlighted.

### Analyse (four chapters)
1. **Oxygen & pressure envelope:** every test's O₂ and pressure range against crew atmospheres, with constant-ppO₂ curves. It shows the key gap: a 30% O₂ lunar cabin has nearly Earth's oxygen partial pressure, BRE flames that self-extinguished at 21% kept burning at 26.5–34%, yet every solid-material flight test stayed at or below 21%.
2. **Gravity spectrum:** microgravity and 1-g data bracket the Moon (0.17 g) and Mars (0.38 g), where no PSI combustion data exists yet. E-FIELD's ion wind is a partial-gravity analog; LUCI and FM2 are planned.
3. **Comparison bench** (above).
4. **Back to Earth:** spin-offs such as water-mist extinguishers, smoke detection, firefighter gear, material standards, wildfire and building models, cleaner engines and confined spaces, each linked to its investigations.

### Ask
- **Role guide:** a persona per role (Fire-safety systems engineer, Modeling liaison, Course architect, Thesis scout, Lab partner) with a five-stop guided route and suggested questions.
- **Grounded AI answers:** answers come only from the dashboard's PSI catalog, cite PSI IDs, and say when PSI does not state something.
- **Acts on the dashboard:** the guide can fly to an investigation, pin investigations for comparison, or switch the habitat, and lists what it did.
- **Always answers:** if the AI service is unavailable, the guide answers from the dashboard's own data and says why.

### Learn the tool
- **Guided tour** on first visit (and from the **?** button): "What brings you here?" goal shortcuts, then 11 spotlight steps explaining each feature and when to use it.

### Two views
- **Dark:** deep space, with a faint painted cyanotype-and-galaxy backdrop behind the chapters.
- **Light:** vintage-poster orange with cream cards, a red planet and drifting rocks behind the constellation, and a grainy thermal-image backdrop behind the chapters.
- All artwork (planet, rocks, galaxy, specimens, astronaut) is drawn in code.

---

## Quality and design choices

- **Calm by design:** one full-screen view; detail opens only when asked (top 3 → card → full dossier).
- **Readable in both views:** separate colour palettes for the 3D view and for charts, cream backings for text on orange, dark panels for charts over the backdrop.
- **Accessible:** keyboard focus, Enter to select, Esc closes panels, ARIA labels, and animations stop when the device asks for reduced motion.
- **Works on phones:** touch rotate and pinch zoom, portrait framing, compact cards.
- **Light on the device:** backgrounds are painted once per screen size, and 3D rendering pauses when scrolled out of view.
- **Remembers you:** role, habitat, view and tour status are saved in the browser.

## AI request limits

The AI guide goes through the project's own endpoint (`/api/ask`), which enforces these limits:

| Limit | Value | Effect |
| --- | --- | --- |
| Requests per visitor | **30 per 10 minutes** (configurable) | Beyond it the guide replies "Too many questions at once. Wait a moment and ask again." (HTTP 429) |
| Requests per question | **1 to 4** | A plain answer is 1 request; each guide action (fly, pin, switch habitat) adds a round, up to 4. So a visitor gets roughly **8–30 questions per 10 minutes**. |
| Conversation memory | Last **4 questions and answers** | Older turns are not sent, which keeps each request small |
| Messages per request | **24** at most, about 150 KB in total | Larger requests are refused (HTTP 400) |
| Answer length | 1,200 tokens (OpenAI-compatible services) or 4,000 (Anthropic, including the model's thinking) | Keeps answers short and costs predictable |
| Scope | The server writes the instructions and allows only the three dashboard actions | The endpoint cannot be used as a general-purpose chatbot |
| Upstream limits | Set by the AI provider's plan | A provider's own rate limit also shows as "Too many questions"; free tiers can run out quickly with several users |

The per-visitor count is kept in memory on each server instance, so on serverless hosts with several instances it is approximate, not a hard cap.

---

## Project layout

```
public/        the website: index.html (layout and styles), app.js (behaviour), data.js (all PSI content), config.js
api/ask.js     AI endpoint (serverless)
lib/guide.js   AI logic: prompt, input checks, rate limit, provider calls
server.js      AI endpoint and static server for Node hosts
docs/SETUP.md  running locally, hosting, and AI service settings
```

Data source: [NASA Physical Sciences Informatics](https://psi.nasa.gov/physci/repo/search?q=combustion&data_source=psi&data_type=investigation). Descriptions are paraphrased from PSI records. 3D rendering uses three.js (MIT licence, in `public/vendor`).
