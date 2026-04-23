# players reorder experience

## purpose of this note

this document focuses only on the core backend/domain mechanics behind the prototype.

the goal is to explain:

- what the source of truth for order is
- how order is represented in the codebase
- how order changes in each scenario
- what the current diffs are trying to achieve

it intentionally skips the detailed history of the ui experiments.

## core design decision

the current prototype is built around one main rule:

- `players_to_tournaments.pairingNumber` is the canonical source of truth for pre-start order

everything else is meant to derive from that:

- the players table order
- the saved round-1 games
- the organizer’s manual round-1 adjustments

the prototype explicitly avoids treating saved games as the primary editable truth. instead it uses this model:

1. update `pairingNumber`
2. regenerate round 1 from that order
3. show the new round-1 games and new table order

that is the most important architectural choice in the whole experiment.

## where order lives

### database

order lives in:

- `src/server/db/schema/tournaments.ts`
  - table: `players_to_tournaments`
  - column: `pairingNumber`

for doubles, the intended semantics are team-level:

- each member of the same team shares the same `pairingNumber`
- swapping doubles order means swapping whole team positions, not swapping members between teams

### canonical server types

the order field surfaces through canonical schemas in:

- `src/server/zod/players.ts`
  - `playerTournamentSchema`

that means every consumer of tournament-player state sees `pairingNumber` as part of the canonical domain shape.

## baseline order rules in the current codebase

before this prototype, the codebase already had a consistent idea of order:

- tournament participants are stored in `players_to_tournaments`
- order-sensitive operations use `pairingNumber` when present
- standings sorting also prefers `pairingNumber` over `addedAt` when standings are equal

the prototype builds on that instead of inventing a second ordering system.

## old reorder prototype that is being removed

the old branch implementation exposed order editing directly as a full reorder operation.

### old api shape

- router mutation: `tournament.reorderPlayers`
- input schema: ordered `playerIds[]`

### old persistence model

in `src/server/mutations/tournament-players.ts`:

- the server loaded all order targets for the tournament
- validated that the full incoming list matched the set of participants
- rewrote `pairingNumber` for every participant according to the submitted order

for doubles:

- the reorder logic already operated on team representatives rather than raw individual rows
- persistence updated all members of the same team together

### why this is being replaced

that old flow was good at reordering the whole participant list, but it was too generic for the actual product goal.

the real goal is:

- control round 1

not:

- arbitrarily reorder the table

so the current diff removes the reorder-specific api and replaces it with a much more concrete operation:

- swap two round-1 slots

## current prototype ordering model

the current diff introduces a simpler and more explicit model:

- order is still `pairingNumber`
- pre-start round 1 is generated deterministically from that order
- manual organizer control is expressed as swapping two participants’ order positions

so instead of:

- “here is the whole order array”

the new operation is:

- “swap this participant with that participant”

that is a much smaller and safer mutation.

## deterministic round-1 generation

### why it was needed

the existing branch used random round-1 generation in several pre-start flows. that made the order model harder to reason about, because:

- `pairingNumber` existed
- but round 1 was not a clean deterministic reflection of it

the prototype fixes that by introducing a deterministic round-1 generator.

### files

- `src/lib/pairing-generators/consecutive-pairs-generator.ts`
- `src/lib/pre-start-round.ts`

### intended behavior

for pre-start round 1:

- players are taken in ascending `pairingNumber`
- games are generated consecutively:
  - `0 vs 1`
  - `2 vs 3`
  - `4 vs 5`
- odd participant count leaves one participant without a game

### important slot rule

the final version of the prototype intentionally preserves slot positions exactly:

- first slot becomes white
- second slot becomes black

this is crucial because organizer swaps are meant to place players in exact visible positions. the generator should not later re-balance colours and undo the user’s intention.

## helper layer for pre-start order

`src/lib/pre-start-round.ts` is the main helper layer that tries to centralize the pre-start logic.

### current responsibilities

#### `assignPairingNumbers(players)`

used when a client-side list already represents the intended current order.

it rewrites pairing numbers sequentially:

- index `0` -> pairing number `0`
- index `1` -> pairing number `1`
- etc

#### `generatePreStartRoundGames({ players, tournamentId })`

generates deterministic round-1 games from the given ordered players.

this is the standard “reflect current order into round 1” helper.

#### `generateShuffledPreStartRoundGames({ players, tournamentId })`

used to keep the shuffle feature conceptually valid.

it does:

1. shuffle players
2. assign new sequential pairing numbers
3. generate consecutive round-1 games from the shuffled order

so shuffle no longer means “random game generator”.
it means:

- randomize order
- then derive round 1 from that order

that is much cleaner.

## current backend mutation: swap round players

### api surface

in `src/server/api/routers/tournament.ts` the prototype introduces:

- `tournament.swapRoundPlayers`

with input schema from:

- `src/server/zod/tournaments.ts`

input:

- `tournamentId`
- `sourcePlayerId`
- `targetPlayerId`

### output

the mutation returns both:

- updated `players`
- updated `games`

that is intentional. swapping affects both order and round-1 representation, so the client gets the full new pre-start state.

## how `swapRoundPlayers` works internally

implementation lives in:

- `src/server/mutations/tournament-games.ts`

### high-level algorithm

1. validate auth and organizer access
2. ensure tournament exists
3. ensure tournament has not started
4. ensure round 1 does not already have decided results
5. load tournament participants and current pairing numbers
6. swap the relevant `pairingNumber` values
7. reload ordered tournament players
8. regenerate round 1 deterministically from the new order
9. replace persisted round-1 games
10. return updated players + games

### important validation rules

the mutation is intentionally narrow:

- organizer only
- pre-start only
- round 1 only
- rejected if round 1 already has results

this keeps it clearly in the “pre-start arrangement” domain rather than becoming a generic game editor.

### solo tournaments

for solo tournaments, the mutation:

- finds `sourceParticipant`
- finds `targetParticipant`
- swaps their `pairingNumber`

that is the only persistent order change.

after that, everything else is derived by regeneration.

### doubles tournaments

for doubles tournaments, the mutation treats teams as the ordering unit.

it uses:

- participant `teamNickname`
- shared `pairingNumber` for team rows

when swapping:

- it does not swap only one member row
- it rewrites `pairingNumber` for all rows belonging to source team
- and for all rows belonging to target team

this preserves team identity and team composition.

## how round-1 games are replaced

there is an internal helper in `src/server/mutations/tournament-games.ts`:

- `replaceRoundGames(...)`

### what it does

for a given round:

1. checks whether any game in that round already has a result
2. if yes, throws `ROUND_ALREADY_HAS_RESULTS`
3. deletes all existing games for that round
4. updates `tournaments.ongoingRound`
5. inserts the new games

this helper is used by:

- generic `saveRound()`
- the new `swapRoundPlayers()` flow

so both paths use the same round replacement semantics.

## how pairing numbers are synchronized from saved games

another important helper added in `src/server/mutations/tournament-games.ts` is:

- `syncPairingNumbersFromGames(...)`

### why this exists

there are now two possible entry points that can affect pre-start round 1:

1. explicit swap mutation
2. generic `saveRound()` when pre-start round 1 is regenerated elsewhere

if round 1 is treated as a saved artifact before start, then saving that round should keep canonical order aligned with it.

### current logic

for solo:

- walk round-1 games in order
- push white player ids first
- push black player ids second
- append any remaining participant not present in games
- rewrite `pairingNumber` in that sequence

for doubles:

- map player ids to team nicknames
- walk round-1 games in order
- push team nicknames in first-seen order
- append any remaining team not present in games
- rewrite `pairingNumber` for every member of each team

### effect

this means:

- saved round-1 games can define canonical order
- canonical order then remains consistent with table sorting and future regeneration

this is a very important part of the prototype, because it closes the loop between:

- saved round-1 games
- `pairingNumber`

## how `saveRound()` changes order in the prototype

`saveRound()` already existed as the generic round persistence mutation.

the prototype changes its behavior for one special case:

- pre-start round 1

### current intended behavior

when `saveRound()` is called:

1. round games are replaced
2. if this is round 1 and tournament has not started:
   - `pairingNumber` is synchronized from the saved games

### why this matters

this means all pre-start round-1 generation paths can still use the generic round-saving mutation and remain order-consistent.

without this sync step, the system would drift:

- saved games would imply one order
- `pairingNumber` could still imply another

## how order is managed in each scenario

this is the most important practical section.

### scenario 1: add new player before tournament start

relevant files:

- `src/server/mutations/tournament-players.ts`
- `src/components/hooks/mutation-hooks/use-tournament-add-new-player.ts`

#### server-side order behavior

the new participant gets:

- `pairingNumber = current participant count`

so new players are appended to the end of current order.

#### client-side round behavior in current diff

after mutation success:

1. client reads updated players list
2. client normalizes pairing numbers locally if needed
3. client generates deterministic pre-start round 1
4. client saves round 1

#### net effect

adding a player means:

- append to the end of order
- rebuild round 1 from the new order

### scenario 2: add existing player before tournament start

relevant files:

- `src/server/mutations/tournament-players.ts`
- `src/components/hooks/mutation-hooks/use-tournament-add-existing-player.ts`

behavior is the same as add-new-player:

- new participant gets next pairing number
- pre-start round 1 is regenerated from full ordered list

### scenario 3: add doubles team before tournament start

relevant files:

- `src/server/mutations/tournament-players.ts`
- `src/components/hooks/mutation-hooks/use-tournament-add-pair-team.ts`

#### server-side order behavior

team order target count is used, not raw member count.

the new team gets the next pairing number.

both member rows are inserted with the same team pairing number.

#### net effect

- new team is appended to current order
- round 1 is regenerated from team order

### scenario 4: remove player before tournament start

relevant file:

- `src/server/mutations/tournament-players.ts`

#### server-side order behavior

after deletion:

- `normalizeTournamentPlayerOrder(...)` is called

that helper:

1. loads remaining order targets
2. sorts them using baseline order rules
3. rewrites pairing numbers sequentially

so deletion compacts order instead of leaving gaps.

#### net effect

- removed participant disappears
- remaining participants are renumbered consecutively
- round 1 is regenerated from the compacted order

### scenario 5: remove doubles team before tournament start

same idea as solo removal, but at team level.

the deletion removes the whole team entry set, then:

- normalizes remaining team order
- reassigns compact pairing numbers

### scenario 6: explicit shuffle before tournament start

relevant files:

- `src/app/tournaments/[id]/dashboard/shuffle-button.tsx`
- `src/lib/pre-start-round.ts`

#### current intended semantics

shuffle should no longer mean:

- generate random games directly

it should mean:

1. randomize participant order
2. assign new sequential pairing numbers
3. regenerate round 1 consecutively from that order

#### net effect

shuffle becomes an order operation, not a game-generation special case.

that keeps the mental model consistent.

### scenario 7: manual organizer swap before start

relevant files:

- `src/server/mutations/tournament-games.ts`
- `src/server/api/routers/tournament.ts`

#### order behavior

the swap operation changes only:

- which two participants occupy which pairing positions

then:

- updated players are reloaded in order
- round 1 is regenerated from that order

#### net effect

manual adjustment is just a very small order mutation.

that is the cleanest possible version of this feature.

### scenario 8: start tournament

relevant file:

- `src/server/mutations/tournament-lifecycle.ts`

`startTournament()` already used first-round games as a practical source when finalizing start state.

the relevant helper there is:

- `updatePairingNumbers(tournamentId)`

#### solo logic

it walks round-1 games and derives player order from them.

in the current diff there is one subtle change:

- the leftover odd player is appended at the end instead of being unshifted to the front

that is important because it matches the deterministic consecutive model more naturally.

#### doubles logic

it derives team order from the first appearance of teams in round-1 games, then rewrites pairing numbers for all team members.

#### why this matters

this means tournament start still aligns canonical order with actual saved round-1 games.

## normalization helpers that affect order

some helpers are not new, but they matter a lot for understanding the prototype.

### `getTournamentOrderTargets(...)`

file:

- `src/server/mutations/tournament-players.ts`

purpose:

- load the entities that should participate in ordering

for solo/team:

- these are participant rows directly

for doubles:

- this collapses rows to one representative per team

### `persistTournamentOrder(...)`

file:

- `src/server/mutations/tournament-players.ts`

purpose:

- take an ordered list of order targets
- rewrite sequential pairing numbers back to the database

for doubles:

- updates all rows of the team together

### `normalizeTournamentPlayerOrder(...)`

file:

- `src/server/mutations/tournament-players.ts`

purpose:

- restore compact sequential order after structural changes like removal

this is why order stays gapless.

## current sync model on the client

while the main value is in backend behavior, the current diff also introduces a new sync pattern that reflects the backend model correctly.

### new mutation hook

- `src/components/hooks/mutation-hooks/use-tournament-swap-round-players.ts`

after a successful swap it updates:

- `playersIn`
- `roundGames` for round 1
- `allGames`

then broadcasts:

- `prestart-round-updated`

### websocket event

handled in:

- `src/lib/handle-dashboard-socket-message.ts`

this is important because the feature changes two caches at once:

- the ordered participant list
- the round-1 games

the prototype correctly treats those as one logical state transition.

## what the current diff is fundamentally trying to achieve

ignoring ui details, the current diff is trying to enforce these invariants:

### invariant 1

pre-start order lives in `pairingNumber`.

### invariant 2

pre-start round 1 is a deterministic reflection of that order.

### invariant 3

manual organizer changes are expressed as order mutations, not ad hoc game editing.

### invariant 4

any time pre-start round 1 is saved, canonical order must be synchronized with it.

### invariant 5

shuffle is just randomized order followed by normal deterministic generation.

## suggested rebuild order from scratch

if rebuilding carefully, the backend-first order should be:

1. add deterministic consecutive round-1 generator
2. add `pre-start-round.ts` helper layer
3. update add/remove/shuffle pre-start flows to use deterministic regeneration
4. adapt `saveRound()` to sync pairing numbers from pre-start round 1
5. add `swapRoundPlayers` mutation
6. verify solo behavior
7. verify doubles team-level behavior
8. add websocket/query sync
9. only then add minimal ui controls

that rebuild order matches the actual dependency chain:

- order model first
- mutation semantics second
- sync third
- ui last

## final takeaway

the real backend idea of the prototype is simple:

- there should be exactly one canonical pre-start order
- that order should be `pairingNumber`
- first-round games should be derived from it deterministically
- every structural change should either preserve, normalize, or intentionally rewrite that order

once that is stable, the ui can be rebuilt in many ways. without that stability, no ui interaction model will stay reliable.
