# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

NB!: THIS IS ONLY FOR SMALL SUBSET, CLIENT ACTIONS. IF YOU WILL WORK WITH SOMETHING OUTSIDE THE client-actions folder, PROMPT THE USER ABOUT IT AND SUGGEST TO MAKE ADDITIONS HERE

## Tournament Generation System (lib/client-actions)

### Development Commands (INCOMPLETE)

- `bun dev` - Start development server
- `bun lint` - Lint the codebase
- `bun format` - Format code with Prettier

### Architecture Overview

**Core Components:**

- `common-generator.ts` - Shared types, interfaces, and utility functions for all tournament generators
- `round-robin-generator.ts` - Round Robin tournament pairing implementation
- `swiss-generator.ts` - Swiss (Dutch) system tournament pairing implementation (currently in development)

### Key Types and Interfaces

**ChessTournamentEntity** - Core entity representing a tournament player:

```typescript
interface ChessTournamentEntity {
  entityId: string;
  colourIndex: number; // Color balance tracking
  entityRating: number; // FIDE rating
  gamesPlayed: number; // Total games played
  entityNickname: string;
  pairingNumber: number; // Pairing system number
  entityTitle: ChessTitle; // Chess title (CM, FM, IM, GM)
  entityScore: number; // Current tournament score
}
```

**RoundProps** - Input interface for round generators:

```typescript
interface RoundProps {
  players: PlayerModel[]; // Current round players
  games: GameModel[]; // Previously played games
  roundNumber: number; // Current round number
  tournamentId: string; // Tournament identifier
}
```

### Swiss System Implementation

The Swiss system follows FIDE Dutch system rules with these phases:

1. **Initial Ordering** - Players sorted by FIDE rating → title → name
2. **Scoregroup Formation** - Players grouped by current score
3. **For each scoregroup:**
   - Parameters estimation (MDP count, max pairs)
   - Inner ordering by score and pairing numbers
   - S1/S2 bracket formation with optional Limbo
   - Provisional pairing
   - Quality evaluation (criteria C1-C13)
   - Alterations if quality unsuccessful
4. **Bracket finalization**

**Key Swiss System Concepts:**

- **MDP (Moved Down Players)** - Players who couldn't be paired in higher scoregroups
- **S1/S2 Brackets** - Upper and lower halves of each scoregroup
- **Limbo** - Excess MDPs that flow to next scoregroup
- **Quality Criteria** - Absolute criteria (C1-C7) and quality criteria (C8-C13)

### Round Robin Implementation

Uses cycle-based pairing where:

- One player remains fixed
- Others rotate positions each round
- Ensures every player plays every other player once

### Code Organization

**Common Utilities:**

- `convertPlayerToEntity()` - Converts PlayerModel to ChessTournamentEntity
- `getColouredPair()` - Assigns colors based on color index and rating
- `getNumberedPair()` - Assigns game numbers to pairs
- `getGameToInsert()` - Converts pairs to database GameModel format

**Testing:**

- Tests available for all generators in corresponding `.test.ts` files (WIP!!!)
- Run tests to verify pairing algorithm correctness

### Development Notes

**Swiss System Status:**

- Currently incomplete - missing quality evaluation and alteration logic
- Provisional pairing implemented
- Need to implement criteria checking and bracket improvements

**Color Assignment:**

- Based on `colourIndex` (tracks color balance)
- Lower-rated player gets white if color indices equal
- System prevents excessive color imbalance (quite normal for pairing systems)

**Error Handling:**

- TypeScript ensures type safety throughout pairing process

### Testing Tournament Generators

Run tests (WIP, now they don't really work) to verify pairing logic:

```bash
# Test specific generator
bun test swiss-generator.test.ts
bun test round-robin-generator.test.ts
bun test common-generator.test.ts
```

## NOTE FOR SWISS SYSTEM

SEE normative documents on https://handbook.fide.com/, and fetch them often, in particular C.04.1 Basic rules for Swiss Systems
C.04.2 General handling rules for Swiss Tournaments
C.04.3 FIDE (Dutch) System

They change yearly, so no static links here, fetch to verify the current version.

## Note for Claude Code

Please, use always the recent documentation version (e.g. Python 3.13 https://docs.python.org/3/library ) and try to reference it in your implemented solutions _often_.  
Fetch documentation very often, it is always useful for you. Also, a good idea that would be smart to analyse always what the author changes in the code suggested, and ask if something wasn't obivous.
Always try to update this file, or suggest an edit, if you see that the operator does something what you didn't expect!
Please, use _only_ Oxford English spelling!

**Code Documentation:**

- Comments should NEVER repeat what's already obvious from the code
- Only add comments that provide additional context, business logic, or non-obvious information
- Focus on WHY something is done, not WHAT is being done

Good coding!
