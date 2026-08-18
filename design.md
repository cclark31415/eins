1.  Create a card game loosely based on Crazy Eights, called Eins.
2.  The game will be a web application hosted on chrisclark.net
3.  The player can play against 3 bot players (we will add the capability for multi-player in the future)
4.  The bot players can randomly be offensive or defensive
5.  The backs of the cards will have the word Eins across them.
6.  The bot players will not know what cards the other players are holding.
7.  The rules use a 114-card four-color deck with action cards: Skip, Reverse, Draw Two, Wild, Wild Draw Four, plus the Eins-specific extras one −1 per color (chain card — play another card on top of it after discarding) and two Wild Draw Six (next player draws 6 and loses turn). Match the top of the discard pile by color or number/symbol.
8.  When a player plays a Skip, Reverse, draw 2, or draw 4 card.  Show a message in the middle of the screen
9.  Draw a box around the current player's cards
10.  When a player gets down to one card, they need to press a button that says "Eins" before laying down their penultimate card
11.  If a player does not click "Eins", the next player can click a challenge button to penalize the previous player for not pressing the Eins button.  The penalty will be drawing six cards
12.  The "Eins" and "Challenge" buttons are always visible.
13.  The "Eins" button does nothing unless the player has two cards left at the beginning of their turn.
14.  If a player clicks the challenge button and the previous player either clicked "Eins" or has more than one card, then the challenging player is penalized with six cards and loses their turn.
15.  Add a version and timestamp of the version change at the bottom of the page
16.  Search engine optimization
17.  Keep score between the players based on the cards remaining at the end of the game.
18.  Cards are scored as follows:  number cards=the value of the card, draw 2/skip/reverse/−1=20 points, wild/wild draw 4/wild draw 6=50 points
19.  The player that wins the game collects the points from the other players.
20.  The first player to hit 500 points wins the tournament
21.  Add animation to show cards moving to the game pile or to the players hand from the draw pile
22.  Add Google oauth to save scores and current game state
23.  If a player has one card remaining, but must draw a card, pressing "Eins" will be required following previous rules.
24.  The current selected color needs to be prominent below the center cards
25.  The shape surrounding the contents of the non-wild cards should be an oval except for 
26.  The number cards from 3 and up which will have a shape corresponding to the number (e.g. 3 is a triangle, 4 is a square, etc.)
27.  At the beginning of the tournament, pick random names for the bot.  The names can be from anywhere in the world, but must be spelled with latin characters.
28.  Any bot player should have a robot emoji next to their name.
28.  If the player is down to one card, then draws one, the Eins button is still disabled.  It should always be enabled whenever it is a player's turn and they have two cards left before playing.
29.  The starting player should be randomly chosen for the first game and then go clockwise for the remainder of the tournament.
30.  Under the human player's cards, have a running log of plays.  For example, "Nia played a +4 to Bob"
31.  Make the most recent play the topmost entry in the log.
32.  Instead of recommending a challenge, there should be a two second pause for the bot players before the next player lays down their cards.  The bot players can think during this period, but there will always be a pause so any player can catch the player that did not call Eins
33.  The deck includes a −1 card — one per color. After playing a −1, the same player gets to discard another card on top of it (a chain). The chained card must follow normal rules (match the −1's color or value, or be a wild). Chains may continue if the next card is also a −1. The −1 scores 20 points if held at round end (same as Skip/Reverse/Draw Two).
34.  The deck includes a Wild Draw Six card — two of them, both wild. When played, the player picks a new active color and the next player draws six cards and loses their turn. It scores 50 points if held at round end (same as other wild cards). On the opening flip the Wild Draw Six is returned to the deck and another card is drawn (same rule as Wild Draw Four).
35.  The bot players should not lay down a simple wild card to change the color to the currently selected color unless it has no other choice.
36.  The human player's cards should highlight all eligible cards to play.
37.  The human player's cards should be grouped by color in incrementing order.
38.  Update to the card deck:  Instead of number cards 0-9, they should be 1-10 with the point value still being the face value.
39.  If the human player chooses to use a wild card, have a Cancel button in the popup so they can change their mind about using the wild card.
