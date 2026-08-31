# Changelog

Every notable change to this project is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [0.4.3] — 2026-08-30

### Changed

- The A/C button in the climate panel now says what tapping it does — "Turn on
  climate" or "Turn off climate" — instead of a fixed name sitting beside three
  buttons that only go one way. It was always a toggle; it just never said so.
  The same applies to the button in the action row and to the confirmation
  prompt.
- The roof row shows the sunshade's position where that is known: `Closed · 0`.
  When open it shows only the state — the position is not exposed as an entity,
  and inventing one would be worse than leaving it out.
- The Trip sub-view now has headings, "Distance" and "Consumption". Its five
  rows mixed kilometres and energy, leaving the reader to separate them.
- "All time" absorbs the total-energy row: the average is the total divided by
  the odometer, so they were one fact stated twice. With the numerator beside
  the result, the "(calculated)" qualifier is no longer needed.
- The last-7-days energy gets a row of its own, called "Energy logged". In the
  integration the distance is a total the API returns already summed, while the
  energy is a day-by-day sum that skips days where the field is absent — they
  are not a matched pair, and writing them side by side promised a shared
  period they do not have. That is also why no average is derived from them.

### Fixed

- Each release page now carries the version's notes, extracted from this file.
  The pages for 0.4.0, 0.4.1 and 0.4.2 came out empty.

## [0.4.2] — 2026-08-30

### Fixed

- A sub-view no longer inherits the height of the tallest one opened before it.
  The card reserved the greatest height it had measured and applied it to all of
  them, and since the climate panel is much taller than the rest, opening it
  once left the others with hundreds of pixels of empty space until the page was
  reloaded. The reservation was removed entirely: each sub-view has its own
  height.
- The roof row, in vehicle status, now opens the sunshade control. The command
  existed — it is the same one the action row uses, which needs a position and
  therefore opens a panel rather than calling a service — but the row had never
  been wired to it.

## [0.4.1] — 2026-08-30

### Fixed

- Dragging a control inside a sub-view no longer switches to another one. The
  two sliders that live in sub-views — the charge limit and the fan — and the
  embedded map were indistinguishable from a horizontal swipe between groups:
  the card jumped mid-gesture. Those controls moved out of the main column,
  which had no gesture at all, in 0.4.0, and that is where the defect came from.
- The status tile no longer claims "All closed" for a car that reported nothing.
  The openings count only counts positive readings, so everything-unknown gave
  zero and read as closed. It now shows `—`, as it already did when the car is
  offline.
- Portuguese gender agreement: "1 aberta" instead of "1 abertos" in the doors
  row, and "Bagageira: Aberta" instead of "Aberto". The roof stays masculine.
- Opening a sub-view no longer scrolls the page when the card is partly off
  screen.

## [0.4.0] — 2026-08-30

### Breaking

- The `sections` option no longer exists. The card's layout is now a grid of
  groups that open sub-views, and which sections are shown follows from which
  groups are in the grid. Replace `sections:` with `grid:` — the card shows a
  warning in place if it still finds the old key. With no `grid:` at all, every
  group whose entities the car reports is shown.

### Added

- A grid of groups on the main view — charging, status, climate, tires, trip and
  location — each with an icon, a title and a live summary, opening a sub-view
  in place with close and previous/next controls. Configurable and reorderable,
  in YAML or in the visual editor.
- Rows in the vehicle-status sub-view command what they show: the locks row
  locks or unlocks, the windows row closes them, the trunk row opens it. Doors
  and roof carry no action, because the integration exposes no command for them.
  `confirm_actions` applies to these rows as it does to the other actions.
- Tile colour follows state: amber for unlocked or an opening open, red for two
  or more tires out of range, the battery colour while charging.
- Tire pressures are laid out around a top view of the car.
- `tire_range` sets the pressure range treated as normal (default `[2.0, 2.6]`,
  the values previously hardcoded).
- Keyboard navigation throughout the sub-view: the arrows move between groups,
  Escape closes and returns focus to the tile that opened it. Horizontal swipe
  on touch.
- The card reserves the height of the tallest sub-view visited, so the dashboard
  stops jumping between them.

### Changed

- The map is built when its sub-view opens, not on every dashboard load.
- The climate panel is now the content of the climate sub-view; it no longer
  expands from a tile.
- Tire warning colours use `--leapmotor-warn` and `--leapmotor-alert` instead of
  borrowing the battery colours.

### Removed

- The interior/openings tile pair, replaced by the grid.
- The two README screenshots, which showed the previous layout.

## [0.3.4] — 2026-08-28

### Added

- A `map_zoom` option for the embedded map's zoom, defaulting to **16** rather
  than Home Assistant's 14, and available in the visual editor. It is clamped to
  1–20 where it is read, not in the editor, because the configuration is also
  written by hand.

### Fixed

- Changing the zoom or the vehicle in the editor now rebuilds the map. Before,
  the map was built once and the preview kept showing the previous one.

### Note

- The map shows an "API KEY REQUIRED" watermark since CARTO began requiring a
  key for the tiles Home Assistant uses. That is a Home Assistant problem
  (`home-assistant/core#180277`), not this card's, and HA's `map` card offers no
  way to pick another provider. An upstream fix is expected.

## [0.3.3] — 2026-08-28

### Changed

- The steering wheel moved down from the dashboard line to in front of the
  driver's seat, aligned with that seat's pill. It was reading as a badge stuck
  to the dashboard rather than a steering wheel.
- The mirrors became **two buttons, one in each corner**, as in the app. Both
  command the same switch — the only one the integration exposes — light up and
  go dark together, and each one's accessible name says it toggles the pair. The
  previous version showed a single button because I had judged two would be
  misleading; they are not, because both mirrors really do heat together. What
  would mislead is two buttons that looked independent.
- The cabin gained twelve units of height at the front, so the steering wheel
  fits between the dashboard and the headrest without touching either.

## [0.3.2] — 2026-08-28

### Changed

- On the steering wheel and the mirrors, **the button became the part**. Both
  were drawn with the button on top, and two overlapping round shapes read as a
  smudge. The drawing underneath is gone; the button sits where the part is.
- The mirrors icon changed from `mdi:mirror-rectangle`, which read as a phone, to
  `mdi:mirror`. The heated-glass icon the app uses was the obvious candidate, but
  in Material Design Icons it is stroke for stroke the same as the Defrost one,
  which already sits at the bottom of this panel — at 18px they would be
  indistinguishable. The heat is stated in the label instead.
- The dashboard line now runs door to door. It used to run mirror to mirror, and
  without them its ends were left hanging in the air.

## [0.3.1] — 2026-08-28

### Changed

- **The climate panel now draws the cabin, not the car seen from outside.** The
  reference is the app's screen, and what it shows is the interior from above —
  seats, console, rear bench — with no bodywork. 0.3.0 drew a whole car because
  the written description said "top view of the car" and nobody had opened the
  image. Fixing that resolved both the overlapping controls and the panel's
  excessive height at once: two wide pills instead of six round pins, and a cabin
  is not as long as a car.
- Each front seat's controls now sit in **a single pill**, with heating and
  ventilation side by side, as in the app. They remain two independent controls;
  the pill groups them, it does not merge them.
- The mirrors button moved next to the drawn mirror and now says "both", because
  the integration exposes **a single switch** for the pair.

### Added

- A visible focus ring on every button in the card, and touch feedback on the
  climate panel's controls.
- A test forcing the PT and EN catalogues to hold exactly the same keys,
  including nested ones. There was none; the catalogues were correct through the
  care of whoever edited them, not through verification.

## [0.3.0] — 2026-08-28

### Added

- A climate panel with the comfort controls overlaid on a drawing of the vehicle
  (replaced in 0.3.1 by the cabin interior): mirrors, steering wheel, and heating
  and ventilation for each front seat. Original drawing, in SVG.
- Fan speed control, from 1 to 7.
- An air-recirculation indicator and control. It is disabled while the climate is
  off, because touching it would require resending the whole command and would
  turn on the air conditioning without the user asking.
- All-time average consumption in the trip section, derived from accumulated
  energy and distance. It is labelled as the card's calculation, not as a reading
  from the car.

### Fixed

- **Every climate command reset the fan to level 3.** The card sent only the mode
  and the temperature, and the integration applied its own defaults to everything
  else. Commands now always carry temperature, fan and recirculation together.
- Changing the temperature undid a recirculation change made before it, and vice
  versa.
- An unconfirmed request stopped being shown when the panel was closed and
  reopened, and the next command was composed from the stale reading.
- A request whose call failed was shown indefinitely, and the next tap started
  from the wrong value.
- The temperature was shown with one decimal place in one place and none in
  another, and a tap on "+" could jump 1.5 degrees.
- A seat's level could appear differently in the comfort section and in the
  climate panel at the same time.

### Changed

- The decisions that command the vehicle — composing the climate command,
  blocking actions while the car is moving, requiring confirmation — became pure
  functions with tests. Two of them can no longer be removed without breaking the
  build.
- The test fixtures and design documents no longer contain data from the real
  vehicle or its owner.

## [0.2.1] — 2026-08-27

First installed version. Vehicle status, actions, charging, tires, trip, comfort,
charging schedule, optional map and sunshade control.
