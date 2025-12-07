# GEMINI.md (formerly CLAUDE.md)

This file provides guidance to Gemini (and other AI agents) when working with code in this repository.

## User Preferences & Strict Requirements

1.  **Proactive Requirement Identification**: Always look for and identify requirements mentioned in user prompts. Add them here if they are recurring or strict.
2.  **Granularity**: Work in small, incremental steps. Avoid large, complex updates in a single turn. Break down tasks into manageable chunks.
3.  **Code Quality**:
    - Write clear, well-commented code.
    - Focus on functional decomposition (avoid large, monolithic functions).
    - Comments should explain _WHY_, not just _WHAT_.
4.  **Testing Protocol**: **NO** test scripts or automated verification until the implementation is explicitly approved by the user.
5.  **Priorities**: Correctness (especially FIDE compliance) takes precedence over premature optimization.

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
  previousGames: GameModel[]; // Player's game history for FIDE color assignment
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

Implements FIDE Dutch system following official handbook guidelines. System handles scoregroup formation, bracket pairing, and quality evaluation according to FIDE criteria.

### Round Robin Implementation

Cycle-based pairing system ensuring every player plays every other player exactly once.

### Code Organization

**Common Utilities:**

- Shared conversion functions between PlayerModel and ChessTournamentEntity
- FIDE-compliant color assignment system
- Game numbering and database conversion utilities

**Testing:**

- Tests available for all generators in corresponding `.test.ts` files (WIP!!!)
- Run tests to verify pairing algorithm correctness

### Development Notes

**Swiss System Status:**

- FIDE-compliant implementation in progress
- Quality evaluation system implemented
- Color assignment follows FIDE Dutch system rules

**Error Handling:**

- TypeScript ensures type safety throughout pairing process

### Testing Tournament Generators

Run tests (WIP) to verify pairing logic:

```bash
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

## Code Quality Rules

**Function Size & Decomposition**

- Max ~40 lines. Extract logical units if longer
- Name all callbacks: `const checkFoo = (x) => ...` NOT `func((x) => ...)`
- One responsibility per function

**Constants & Control Flow**

- Name all sentinel values: `const NO_EDGE_FOUND = null`
- Meaningful loop conditions: `while (!done)` NOT `while (true) { if (x) break; }`
- No magic numbers or strings

**Type Safety**

- Avoid `as` assertions. Use type guards (`typeof x === 'string'`) or redesign
- Document type design choices (e.g., "BlossomId=number, VertexKey=string enables `typeof` discrimination")

**Avoid Redundancy**

- Extract common patterns after 3rd occurrence
- Simplify discriminated unions unless truly needed
- Remove redundant checks (if loop handles it, don't also `break`)

**Comments**

- Explain WHY, not WHAT
- Document non-obvious invariants and data structure relationships
- Include complexity for algorithms

Good coding!
