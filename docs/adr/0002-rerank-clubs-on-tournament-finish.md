# re-rank clubs when tournaments finish, never on a schedule

the ranks in `player_stats` are row numbers, not a competitive ranking: every club player is numbered by rating, tournaments played, tournaments won and games played, with ties falling back to rating, stored rd, last seen and id. they let a pinned or searched row in the club's player list show its real place without loading the pages before it.

ranks are a snapshot, recomputed in the same transaction as the events that change a club's results: a tournament finishing, and the corrections to that history (deleting a finished tournament, merging players, deleting a player who has ranks). a player created since the last re-rank has no ranks until the next one, whether or not they play. nothing re-ranks a club on a timer, and no cron for it is planned.

nothing on the club page depends on the clock: ranks use only stored values, and the club page marks a rating provisional by its stored rd, which only changes when the player plays. so a club nobody uses keeps its last state for good, even once its players' rd would have grown past the established threshold. this is intentional: a scheduled refresh would keep rewriting abandoned clubs until every player in them was unestablished, which helps no one. the player page alone grows rd with inactivity and marks the rating provisional once it passes the threshold.

clubs ranked under the earlier rule (established ratings and non-zero counts only) switch at their next re-rank; there is no backfill.
