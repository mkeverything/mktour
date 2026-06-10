# derive pre-start games instead of persisting them

before a tournament starts, round-1 games are preview state derived from ordered tournament units rather than persisted game rows. pre-start mutations update only units/order and return units; `roundGames(1)` derives preview games on read; `startTournament` materializes real round-1 games. this keeps pre-start writes small and avoids long serialized transactions when organizers rapidly edit participants.
