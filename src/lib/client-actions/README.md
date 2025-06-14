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

##
