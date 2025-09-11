# Overview

This folder mostly contains client-specific actions, for now it is only pariing generators.

# Swiss (Dutch) System

A high level overview would be formatted like this: Basically, in the swiss system, the players first (for every round), are routed through the inner ranking, then they arre united to the scoregroups, then the pairing starts by defining key parameters of the bracket, separation of the players to inner-parts of the bracket, then provisional pairing, then evaluation phase, then possible alteration of the bracket until it will comply with all the quality criterions. The pairing is done in top down fashion. More formally, there are four main parts of the pairing process, and some additional ones:

1. Initial ordering of players
2. Scoregroups formation
3. For each scoregroup:
   1. Parameters estimation
   2. Inner ordering
   3. S1 and S2 formation
   4. Provisional pairing, limbo formation
   5. Quality evaluation
   6. Alterations if quality unsuccessful
4. Finalisation of the bracket

Next, we present a thorough description of all the logical blocks of the pairing process

## Initial ordering block

First priority is FIDE rating, then player title, then player name. Simple ordering, the result is pairing numbers.

## Scoregroups formation

Initial scoregroup formation is just separation of players by score. Obvioously, at start everyone have the same score, but later one it will become more and more fragmented. The assumed datastracture to hold would be the map list of entities by number.

## Parameters estimation

The parameters estimation is a phase where we need to calculate several important numbers. First we check the MDP number,' which is how many downfloaters we got from previous bracket. next we estimate the maximum pairs number, which is equal to half of player amount or the resident players count (min between those two quantities, against many mdps). Then we calculate maximum mdp pairings M1, it is either mdp count or maxpairs, what is smaller.

A big question is how to perform the flow with the MDPs. SHould it be a global tracking class?

## Inner ordering

the ordering is simple, it is score based, the initial order parinig numbers and subsequent alterations and transpositions

## Bracket formation

We calculate N1 (for heterobrackets it is M1, else it is maxpairs), and get the S1 part of N1 players ordered, and S2 rest. M0 (initial mdp count) - M1 playres are assigned to limbo.

## Provisional pairing

The initial provisional pairing is elementary, the S1 first with S2 first, and so on. If the bracket is homo, the pairing is immediately gonig to be evaluated, with all remaining players bound to MDP. If it was hetero, then first all the mdps are paired from s1 to residents from s2. Then if any resident left, they go to remainder bracket and paired as homo. Those two become candidates (MDP and remainder). All Limbo downfloat.

## Topscorers

They appear only in the final round, and they are those who have more than 50$ of total possible score .

## Colour allocation

If that's the first round, then it is just random for all the pairs.

Other rounds get the colour preferences (priority sorted cases):

1. both colour preferences satisfied.
2. stronger colour preference only. For topscorers with both absolute colours, do the wider preference (bigger), either will then violate the C3 criterion (probably we still need to do it for all of the pairs still, because violation of colouring (C3) is the different stage).
3. alternate the colours to the last time when both players were one white and another black (and get the vice versa). Also don't forget that pairing byes or skips are for such purposes moved to the start of the playing history, as if it was played initially (the PAB). see 4.5 of GENERAL HANDLING document.
4. Higher ranked player gets their colour preference.
5. If a higher ranked player has an odd pairing number, give them initial colour ( save an initial colour then?). Otherwise give the opposite to them. (Don't forget about Late Entries, and Initial Order sections of the General Handling document.)

## Quality evaluation

Here the criterions are evaluated for the pairs.

First we check that all players never played before (checking games).

No player with pair allocating bye should get it again (or other way of winning without playing): checked with the help of keeping track of PABs.

Non topscorers with same absolutecolour preference should not meet (probably having a special mark of non-topscorer) and the colour preferences list. To calculate colour preference we check the colour index, if it is absolutely bigger than one, that is absolute, strong is when 1, mild is 0, none, if never played.

Thos three can't be violated.

the players downfloating and the plaers from another groups should allow the pairing is the next crit. dunno how to check to be honest.

final absolute criterion is the minimisation of the PAB receiver score.

Then quality criterias go:

Have as small amount of downfloaters as possible. (keep track of downfloaters count and compare)

minimse the PSD. score calculation is done like this, for resident players and MDPS it is equal to absolute score difference. Each downfloater contributes to difference between his score and the one point less than the lowest score in paired bracket.

C8 is a lookahead criterion, which checks that the current set of downfloaters will allow next bracket to be compilant with the C1-C7

Next 12 criterions are basically the different metrics to be defined of the bracket. that is, in order:

1. minimise unplayed games for a receiver of PAB (keep track of unplayed games)
2. topscorers or topscorer opponents who get colour difference higher than 2 absolutely (count separately this as part of quality)
3. minimise the topscorers or topscorer opponenst who get the same colour three times in a row or more (keep track of that as well)
4. minimise the players who don't get their colour preference
5. minimise the players who don't get their strong colour preference
6. minimise the players who receive same downfloat as previous round
7. minimisethe players who got the same upfloat as previous round (paired up again)
   8 and 9 are the same as 6 and 7, just the look back is two rounds
8. minimse the pair score differences between the downfloaters same for oune round
9. minimise the PSD between the similar upfloater
   12 and 13 are the same, but with the outlook of 2 rounds

## Alterations if unsuccessful

if some of the criterion is violated, we build a new candidate by the defined alterations.
First we calculate the BSNs, according to the standard ordering, and add them.

We then need to build and follow the sequences of alterations (probably all of them).

If the bracket is homo, we check first if there are transpositions left (at the first time we bulid a list of transpositions). A list of transpositions for the S2 part is build and ordered like this: We take first N1 entries, and sort them according the lexicographical order. We get a new one and build a new candidate.

If the bracket is homo, but we have no transpositions left, we build a set of resident exchanges between the S1 and S2. We order them by the priorities, and obviously they can be of a size of maxpairs iirc. First the smallest exchanges go (1 priority is the number of exchanged playres), second is the sum of BSNs should be minimal, then the highest different BSN (from the S1) and the final is the lowest different BSN (from the S2) ; so the exchanged players should be near the split. We get the next in order of those exchanges, and build a candidate again.

If the bracket was hetero, the remainder part (after the mdp pairing) is paired as homo bracket (go there to see). When the options for the remainder (transpositions and exchanges) will be exhausetd, start transposing the S2 (before the mdp parinig), getting the new remainder, and running the whole sequence with it. If the transpositions of S2 will be exhausted, you can start exchanging the MDPs between the S1 and Limbo , sorted by the C7 and the lexicographic order, in ascending order.

If there are no direct winners of the candidate, if there are many with the absolute first you rate the brackets by the C5 criteria , then by teh quality criterias in order, and then by precedence. take the best!

## Finalisation step

getting the bracket and then converting it to the games, hooray!
