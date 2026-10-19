# re-rank clubs when tournaments finish, never on a schedule

club ranks in `player_stats` are a snapshot of the club. they are recomputed in the same transaction as the events that change its results: a tournament finishing, and the corrections to that history (deleting a finished tournament, merging or deleting players). nothing re-ranks a club on a timer, and no cron for it is planned.

rd grows with inactivity, so between tournaments a ranked player's rating can stop being established. the ranking keeps treating it as established until the club's next re-rank, and a club nobody uses keeps its last ranking for good. this is intentional: a scheduled re-rank would keep rewriting abandoned clubs until every player in them was unestablished, which helps no one. a club's ranking only changes when someone in the club acts.
