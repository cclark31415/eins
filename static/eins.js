/* Eins - a card game loosely based on Crazy Eights, single player vs 3 bots. */
(() => {
'use strict';

// --- Constants ---

const COLORS = ['red', 'yellow', 'green', 'blue'];
const HAND_COLOR_ORDER = ['blue', 'green', 'red', 'yellow'];
const NUM_PLAYERS = 4;
const HAND_SIZE = 7;
// Bots wait 2s before each play — their "thinking" time and the window
// during which they auto-challenge a missed Eins call.
const BOT_DELAY_MS = 2000;
const POST_DRAW_AUTO_END_MS = 900;

const GLYPHS = {
    skip: '⊘',
    reverse: '⇄',
    draw2: '+2',
    wild: '★',
    wild4: '+4',
    wild6: '+6',
    '-1': '−1',
};

const TOAST_LABELS = {
    skip: 'Skip',
    reverse: 'Reverse',
    draw2: 'Draw 2',
    wild4: 'Draw 4',
    wild6: 'Draw 6',
    minus1: 'Play Again',
};

// Probability a bot remembers to call Eins on its penultimate play.
const BOT_EINS_REMEMBER = 0.7;


// Pool of bot names — multicultural, Latin-character spellings only.
const BOT_NAME_POOL = [
    'Aiko', 'Akira', 'Hiroshi', 'Yuki', 'Sora',
    'Mei', 'Wei', 'Lihua', 'Jin', 'Xiu',
    'Raj', 'Priya', 'Anil', 'Asha', 'Vikram',
    'Diego', 'Sofia', 'Mateo', 'Lucia', 'Esteban',
    'Pierre', 'Camille', 'Luc', 'Margot', 'Juliette',
    'Hans', 'Greta', 'Klaus', 'Anika', 'Lukas',
    'Amir', 'Layla', 'Omar', 'Yusuf', 'Zara',
    'Chika', 'Tendai', 'Adaeze', 'Kofi', 'Nia',
    'Sven', 'Astrid', 'Erik', 'Freya', 'Bjorn',
    'Igor', 'Natasha', 'Anya', 'Sasha', 'Mikhail',
    'Liam', 'Aoife', 'Ciaran', 'Saoirse', 'Eoin',
    'Hakan', 'Selin', 'Murat', 'Aylin',
    'Kwame', 'Ama', 'Akosua', 'Yaw',
    'Niko', 'Eleni', 'Yiannis', 'Despina',
    'Hong', 'Minjun', 'Soo', 'Jiho',
    'Iker', 'Maite', 'Aroa',
    'Kiri', 'Aroha', 'Mateus', 'Ines'
];

function pickBotNames() {
    const pool = BOT_NAME_POOL.slice();
    shuffle(pool);
    // Index 0 is the human; bots are 1..3.
    return [null, pool[0], pool[1], pool[2]];
}

// --- Pure deck/state helpers ---

let nextCardId = 1;
function makeCard(color, value) {
    return { id: nextCardId++, color, value };
}

function buildDeck() {
    const deck = [];
    for (const color of COLORS) {
        deck.push(makeCard(color, '10'));
        deck.push(makeCard(color, '-1')); // one chain card per color
        for (let n = 1; n <= 9; n++) {
            deck.push(makeCard(color, String(n)));
            deck.push(makeCard(color, String(n)));
        }
        for (const v of ['skip', 'reverse', 'draw2']) {
            deck.push(makeCard(color, v));
            deck.push(makeCard(color, v));
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push(makeCard('wild', 'wild'));
        deck.push(makeCard('wild', 'wild4'));
    }
    for (let i = 0; i < 2; i++) {
        deck.push(makeCard('wild', 'wild6')); // two Wild Draw Six cards
    }
    return deck; // 114
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Values that are wild no matter what colour is currently painted on the
// card. isWild() derives wildness from c.color, so a recycled wild that kept
// a chosen colour would silently stop being treated as wild — see drawOne().
const WILD_VALUES = ['wild', 'wild4', 'wild6'];

const isWild = (c) => c.color === 'wild';
const isAction = (c) => WILD_VALUES.includes(c.value)
    || ['skip', 'reverse', 'draw2', '-1'].includes(c.value);

function canPlay(card, top, currentColor) {
    if (isWild(card)) return true;
    return card.color === currentColor || card.value === top.value;
}

function topCard(state) {
    return state.discardPile[state.discardPile.length - 1];
}

function advance(state) {
    state.currentPlayer = (state.currentPlayer + state.direction + NUM_PLAYERS) % NUM_PLAYERS;
}

const CARD_VALUES = {
    skip: 20, reverse: 20, draw2: 20,
    wild: 50, wild4: 50, wild6: 50,
    '-1': 20,
};
function cardValue(c) {
    if (CARD_VALUES[c.value] !== undefined) return CARD_VALUES[c.value];
    return Number(c.value);
}
function handValue(hand) {
    return hand.reduce((s, c) => s + cardValue(c), 0);
}

function drawOne(state) {
    if (state.deck.length === 0) {
        if (state.discardPile.length <= 1) return null;
        const top = state.discardPile.pop();
        // Reset every wild back to the wild colour when recycled, so a wild
        // can never come back out of the deck wearing a played colour.
        const recycled = state.discardPile.map(c =>
            WILD_VALUES.includes(c.value) ? { ...c, color: 'wild' } : c);
        state.discardPile = [top];
        state.deck = shuffle(recycled);
        state.reshufflePending = true;
        state.reshuffleCount = recycled.length;
    }
    return state.deck.pop() || null;
}

function drawN(state, playerIdx, n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
        const c = drawOne(state);
        if (!c) break;
        state.hands[playerIdx].push(c);
        drawn.push(c);
    }
    // Drawing always invalidates a prior Eins call: the player must call
    // again before their next penultimate play.
    if (drawn.length > 0) state.einsCalled[playerIdx] = false;
    return drawn;
}

// --- Game lifecycle ---

function newGame(prev = null) {
    nextCardId = 1;
    const deck = shuffle(buildDeck());
    const hands = [[], [], [], []];
    for (let i = 0; i < HAND_SIZE; i++) {
        for (let p = 0; p < NUM_PLAYERS; p++) {
            hands[p].push(deck.pop());
        }
    }

    // Official rule: if first card is Wild Draw Four (or Wild Draw Six),
    // return it and draw again.
    let top;
    while (true) {
        top = deck.pop();
        if (top.value === 'wild4' || top.value === 'wild6') {
            deck.unshift(top);
            shuffle(deck);
            continue;
        }
        break;
    }

    // First round of a tournament: random starter. Subsequent rounds: rotate
    // clockwise from the previous round's starter.
    const startingPlayer = prev
        ? (prev.startingPlayer + 1) % NUM_PLAYERS
        : Math.floor(Math.random() * NUM_PLAYERS);

    const state = {
        deck,
        hands,
        discardPile: [top],
        currentColor: isWild(top) ? COLORS[Math.floor(Math.random() * 4)] : top.color,
        direction: 1,
        currentPlayer: startingPlayer,
        startingPlayer,
        strategies: [null,
            Math.random() < 0.5 ? 'offensive' : 'defensive',
            Math.random() < 0.5 ? 'offensive' : 'defensive',
            Math.random() < 0.5 ? 'offensive' : 'defensive',
        ],
        gameOver: false,
        winner: null,
        // Human turn UI flags:
        awaitingColor: false,
        pendingWildPlay: null,
        drewThisTurn: false,
        drawnCardId: null,
        // Eins / Challenge state
        einsCalled: [false, false, false, false],
        lastActor: null, // last player to actually play a card (for challenges)
        skipNextTurn: [false, false, false, false], // bad-challenge "lose turn" flag
        // Tournament state (persists across rounds)
        tournamentScores: prev ? prev.tournamentScores.slice() : [0, 0, 0, 0],
        roundNumber: prev ? prev.roundNumber + 1 : 1,
        tournamentWinner: prev ? prev.tournamentWinner : null,
        botNames: prev ? prev.botNames.slice() : pickBotNames(),
        lastRoundResult: null,
        log: [],
        reshufflePending: false,
        reshuffleAnimating: false,
        reshuffleCount: 0,
    };

    // Local name lookup — playerName() reads the global state which is still
    // the previous round at this point, so reach into the local state directly.
    const nameOf = (idx) => idx === 0 ? 'You' : `🤖 ${state.botNames[idx]}`;

    // Apply opening-card effects relative to the actual starting player.
    const openMessages = [];
    openMessages.push(
        startingPlayer === 0
            ? `You start round ${state.roundNumber}.`
            : `${nameOf(startingPlayer)} starts round ${state.roundNumber}.`
    );
    if (top.value === 'skip') {
        const skipped = state.currentPlayer;
        advance(state);
        openMessages.push(`Opening Skip — ${nameOf(skipped)} ${skipped === 0 ? 'lose' : 'loses'} the first turn.`);
    } else if (top.value === 'reverse') {
        // Per design, direction only flips when a player plays a Reverse card.
        // The opening flip leaves direction unchanged.
        openMessages.push(`Opening Reverse — no effect.`);
    } else if (top.value === 'draw2') {
        const victim = state.currentPlayer;
        drawN(state, victim, 2);
        syncEinsFlags(state);
        advance(state);
        openMessages.push(`Opening Draw Two — ${nameOf(victim)} ${victim === 0 ? 'draw' : 'draws'} 2 and ${victim === 0 ? 'lose' : 'loses'} the turn.`);
    } else if (top.value === 'wild') {
        openMessages.push(`Opening Wild — color set to ${state.currentColor}.`);
    }
    state.openingMessages = openMessages;
    return state;
}

function endRound(state) {
    const winner = state.winner;
    let total = 0;
    const breakdown = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
        const v = i === winner ? 0 : handValue(state.hands[i]);
        total += v;
        breakdown.push({ idx: i, points: v, cards: state.hands[i].length });
    }
    state.tournamentScores[winner] += total;
    state.lastRoundResult = { winner, points: total, breakdown };
    if (state.tournamentScores[winner] >= 500) {
        state.tournamentWinner = winner;
    }
}

// --- Move execution ---

function executePlay(state, playerIdx, cardIdx, chosenColor) {
    const card = state.hands[playerIdx].splice(cardIdx, 1)[0];
    state.discardPile.push(card);
    state.lastActor = playerIdx;

    if (isWild(card)) {
        state.currentColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
    } else {
        state.currentColor = card.color;
    }

    state.drewThisTurn = false;
    state.drawnCardId = null;

    if (state.hands[playerIdx].length === 0) {
        state.gameOver = true;
        state.winner = playerIdx;
        endRound(state);
        return { card, effect: 'win' };
    }

    let effect = null;
    let victim = null;
    let playAgain = false;
    switch (card.value) {
        case 'skip':
            advance(state); // skipped player
            victim = state.currentPlayer;
            effect = 'skip';
            break;
        case 'reverse':
            state.direction = -state.direction;
            effect = 'reverse';
            break;
        case 'draw2':
            advance(state);
            victim = state.currentPlayer;
            drawN(state, state.currentPlayer, 2);
            animateDrawN(state.currentPlayer, 2);
            effect = 'draw2';
            break;
        case 'wild4':
            advance(state);
            victim = state.currentPlayer;
            drawN(state, state.currentPlayer, 4);
            animateDrawN(state.currentPlayer, 4);
            effect = 'wild4';
            break;
        case 'wild6':
            advance(state);
            victim = state.currentPlayer;
            drawN(state, state.currentPlayer, 6);
            animateDrawN(state.currentPlayer, 6);
            effect = 'wild6';
            break;
        case 'wild':
            effect = 'wild';
            break;
        case '-1':
            // Chain card: same player plays again. Don't advance.
            playAgain = true;
            effect = 'minus1';
            break;
    }

    syncEinsFlags(state);
    if (!playAgain) advance(state);
    return { card, effect, victim, playAgain };
}

// Eins flags persist while a player is at 1-2 cards; they're cleared once
// the player has more than 2 cards (whether from drawing, penalty, or recycle).
function syncEinsFlags(state) {
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (state.hands[p].length > 2) state.einsCalled[p] = false;
    }
}

// --- Bot AI ---

function pickWildColor(hand, currentColor = null, avoidCurrentColor = false) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    for (const c of hand) {
        if (!isWild(c)) counts[c.color]++;
    }
    const preferred = avoidCurrentColor
        ? COLORS.filter(c => c !== currentColor && counts[c] > 0)
        : COLORS;
    const candidates = preferred.length > 0 ? preferred : COLORS;
    let best = candidates[0] || COLORS[0], bestN = -1;
    for (const c of candidates) {
        if (counts[c] > bestN) { best = c; bestN = counts[c]; }
    }
    if (bestN === 0) {
        // No colored cards to steer by — pick at random, but still honour the
        // "don't re-select the active color" rule.
        const pool = avoidCurrentColor ? COLORS.filter(c => c !== currentColor) : COLORS;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return best;
}

// Score for offensive: higher is more attractive to play first.
function scoreOffensive(card) {
    switch (card.value) {
        case 'wild6':   return 110;
        case 'wild4':   return 100;
        case 'draw2':   return 90;
        case 'skip':    return 80;
        case '-1':      return 75; // chain lets us dump more cards on the same turn
        case 'reverse': return 70;
        case 'wild':    return 60;
        default:        return 10 + Number(card.value); // 10..19
    }
}

// Defensive: prefer numbers (lower first), save action cards.
function scoreDefensive(card) {
    switch (card.value) {
        case 'wild6':   return 1;
        case 'wild4':   return 2;
        case 'wild':    return 5;
        case 'draw2':   return 20;
        case 'skip':    return 25;
        case 'reverse': return 30;
        case '-1':      return 110; // chain card — always good to dump
        default: {
            const n = Number(card.value);
            // Higher numbers are bigger penalty if caught — play them sooner.
            return 100 - n; // 1 -> 99, 10 -> 90
        }
    }
}

// Spending a wild without changing the active color only pays off when
// there is something urgent to answer — an opponent one or two cards from
// going out, where landing the draw penalty matters more than the color.
function opponentAboutToWin(state, playerIdx) {
    for (let p = 0; p < NUM_PLAYERS; p++) {
        if (p !== playerIdx && state.hands[p].length <= 2) return true;
    }
    return false;
}

function botChoosePlay(state, playerIdx) {
    const hand = state.hands[playerIdx];
    const top = topCard(state);
    const playable = [];
    for (let i = 0; i < hand.length; i++) {
        if (canPlay(hand[i], top, state.currentColor)) playable.push(i);
    }
    if (playable.length === 0) return null;

    // A simple Wild should not be used merely to re-select the active color
    // while another legal card is available.
    const nonWildPlayable = playable.filter(idx => hand[idx].value !== 'wild');
    const choices = nonWildPlayable.length > 0
        ? playable.filter(idx => hand[idx].value !== 'wild')
        : playable;

    const strat = state.strategies[playerIdx];
    const scorer = strat === 'offensive' ? scoreOffensive : scoreDefensive;

    let bestIdx = choices[0];
    let bestScore = scorer(hand[bestIdx]);
    for (let k = 1; k < choices.length; k++) {
        const idx = choices[k];
        const s = scorer(hand[idx]);
        if (s > bestScore) { bestIdx = idx; bestScore = s; }
    }
    return bestIdx;
}

// --- Logging ---

function describeCard(card) {
    if (card.value === 'wild') return 'a Wild';
    if (card.value === 'wild4') return 'a Wild Draw Four';
    if (card.value === 'wild6') return 'a Wild Draw Six';
    const colorLabel = card.color[0].toUpperCase() + card.color.slice(1);
    if (card.value === 'skip') return `a ${colorLabel} Skip`;
    if (card.value === 'reverse') return `a ${colorLabel} Reverse`;
    if (card.value === 'draw2') return `a ${colorLabel} Draw Two`;
    if (card.value === '-1') return `a ${colorLabel} Minus One`;
    return `a ${colorLabel} ${card.value}`;
}

function describePlay(actorIdx, card, result, chosenColor) {
    let phrase = `${playerName(actorIdx)} played ${describeCard(card)}`;
    if (chosenColor && (card.value === 'wild' || card.value === 'wild4')) {
        phrase += ` (${chosenColor})`;
    }
    if (result && result.victim !== null && result.victim !== undefined) {
        phrase += ` on ${playerName(result.victim)}`;
    }
    return phrase + '.';
}

function playerName(idx) {
    if (idx === 0) return 'You';
    const name = state && state.botNames ? state.botNames[idx] : `Bot ${idx}`;
    return `🤖 ${name}`;
}

function logEvent(state, msg) {
    state.log.push(msg);
    if (state.log.length > 30) state.log.shift();
}

// --- Rendering ---

const els = {};
let state = null;
let humanInputLocked = false;

function $(id) { return document.getElementById(id); }

function cardEl(card, opts = {}) {
    const el = document.createElement('div');
    el.className = 'card';
    if (opts.faceDown) {
        el.classList.add('back');
        const t = document.createElement('span');
        t.className = 'back-text';
        t.textContent = 'Eins';
        el.appendChild(t);
        return el;
    }
    el.classList.add('face');
    el.classList.add(card.color);
    if (isAction(card)) el.classList.add('action');

    // Number cards 3-10 take an N-gon shape that matches their digit count.
    const numValue = Number(card.value);
    if (!isWild(card) && Number.isInteger(numValue) && numValue >= 3 && numValue <= 10) {
        el.classList.add(`shape-${numValue}`);
    }

    const inner = document.createElement('div');
    inner.className = 'inner';

    // Shape and glyph are siblings: clip-path on the shape would otherwise
    // clip the digit too.
    if (!isWild(card)) {
        const shape = document.createElement('div');
        shape.className = 'center-shape';
        inner.appendChild(shape);
    }
    const glyph = document.createElement('div');
    glyph.className = 'glyph';
    glyph.textContent = GLYPHS[card.value] ?? card.value;
    inner.appendChild(glyph);

    const tl = document.createElement('div');
    tl.className = 'corner tl';
    tl.textContent = GLYPHS[card.value] ?? card.value;
    const br = document.createElement('div');
    br.className = 'corner br';
    br.textContent = GLYPHS[card.value] ?? card.value;
    inner.appendChild(tl);
    inner.appendChild(br);

    el.appendChild(inner);
    return el;
}

// Cards drawn per opponent hand, from the --fan-max custom property. It is
// declared on :root (the card-size budget reads it too) and inherited here.
function fanMax(handEl) {
    const raw = getComputedStyle(handEl).getPropertyValue('--fan-max');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 7;
}

function renderOpponent(seat) {
    const handEl = $(`hand-${seat}`);
    const countEl = $(`count-${seat}`);
    const scoreEl = $(`score-${seat}`);
    const nameEl = $(`name-${seat}`);
    handEl.innerHTML = '';
    const n = state.hands[seat].length;
    countEl.textContent = String(n);
    if (scoreEl) scoreEl.textContent = String(state.tournamentScores[seat]);
    if (nameEl) nameEl.textContent = playerName(seat);
    // Show a fan of card backs, capped at --fan-max. The cap lives in CSS
    // because CSS also sizes the cards around it; reading it back here keeps
    // the rendered count and the space reserved for it in agreement.
    const shown = Math.min(n, fanMax(handEl));
    for (let i = 0; i < shown; i++) {
        handEl.appendChild(cardEl(null, { faceDown: true }));
    }
    const wrapper = handEl.parentElement;
    wrapper.classList.toggle('active', state.currentPlayer === seat && !state.gameOver);

    // Show "EINS!" indicator when an opponent successfully called.
    const meta = wrapper.querySelector('.opponent-meta');
    let flag = meta.querySelector('.eins-flag');
    const showFlag = n <= 1 && state.einsCalled[seat] === true;
    if (showFlag) {
        if (!flag) {
            flag = document.createElement('span');
            flag.className = 'eins-flag';
            flag.textContent = 'EINS!';
            meta.appendChild(flag);
        }
    } else if (flag) {
        flag.remove();
    }
}

function renderPlayer() {
    const handEl = $('hand-0');
    handEl.innerHTML = '';
    const top = topCard(state);
    const hand = state.hands[0];
    const isHumanTurn = state.currentPlayer === 0 && !state.gameOver && !humanInputLocked;
    document.querySelector('.player').classList.toggle('active', state.currentPlayer === 0 && !state.gameOver);
    const scoreEl = $('score-0');
    if (scoreEl) scoreEl.textContent = String(state.tournamentScores[0]);
    const roundEl = $('round-number');
    if (roundEl) roundEl.textContent = String(state.roundNumber);

    const orderedHand = hand
        .map((card, originalIndex) => ({ card, originalIndex }))
        .sort((a, b) => {
            const aColorOrder = a.card.color === 'wild' ? HAND_COLOR_ORDER.length : HAND_COLOR_ORDER.indexOf(a.card.color);
            const bColorOrder = b.card.color === 'wild' ? HAND_COLOR_ORDER.length : HAND_COLOR_ORDER.indexOf(b.card.color);
            const colorOrder = aColorOrder - bColorOrder;
            if (colorOrder !== 0) return colorOrder;
            const aNumber = Number(a.card.value);
            const bNumber = Number(b.card.value);
            const aValue = Number.isNaN(aNumber) ? 100 : aNumber;
            const bValue = Number.isNaN(bNumber) ? 100 : bNumber;
            return aValue - bValue || a.card.value.localeCompare(b.card.value);
        });

    for (const { card: c, originalIndex } of orderedHand) {
        const el = cardEl(c);
        // Drawing does not restrict what you may play. If you draw a card you
        // would rather hold (say a Wild Draw Six), you can still play any
        // other legal card in hand and keep it.
        const playable = isHumanTurn && canPlay(c, top, state.currentColor);
        el.classList.add(playable ? 'playable' : 'unplayable');
        el.dataset.cardId = String(c.id);
        el.setAttribute('aria-label', `${describeCard(c)}${playable ? ', playable' : ', not playable'}`);
        el.setAttribute('aria-disabled', String(!playable));
        if (playable) {
            el.setAttribute('role', 'button');
            el.tabIndex = 0;
            el.addEventListener('click', () => onHumanPlay(originalIndex));
            el.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onHumanPlay(originalIndex);
                }
            });
        }
        handEl.appendChild(el);
    }
}

function humanCardElement(card) {
    return [...$('hand-0').children].find(el => el.dataset.cardId === String(card.id)) || null;
}

function renderDiscard() {
    const pile = $('discard-pile');
    const old = pile.querySelector('.card');
    if (old) old.remove();
    const top = topCard(state);
    const el = cardEl(top);
    pile.insertBefore(el, pile.firstChild);
}

function renderPileCounts() {
    const drawCount = $('draw-count');
    const discardCount = $('discard-count');
    if (drawCount) drawCount.textContent = String(state.deck.length);
    if (discardCount) discardCount.textContent = String(state.discardPile.length);
    $('draw-pile').classList.toggle('reshuffling', state.reshuffleAnimating);
    $('discard-pile').classList.toggle('reshuffling', state.reshuffleAnimating);
}

function renderColorIndicator() {
    const el = $('current-color');
    el.classList.remove('red', 'yellow', 'green', 'blue');
    el.classList.add(state.currentColor);
    el.querySelector('.label').textContent = state.currentColor;
}

function renderDirection() {
    const el = $('direction-indicator');
    if (!el) return;
    const cw = state.direction === 1;
    const glyph = el.querySelector('.arrow-glyph');
    const label = el.querySelector('.arrow-label');
    if (glyph) glyph.textContent = cw ? '↻' : '↺';
    if (label) label.textContent = cw ? 'clockwise' : 'counter-clockwise';
}

function renderStatus(msg, alert = false) {
    const s = $('status');
    s.textContent = msg;
    s.classList.toggle('alert', alert);
}

// --- Card-flight animation ---

const ANIM_PLAY_MS = 320;
const ANIM_DRAW_MS = 240;

function flyCard(srcRect, dstRect, ghostEl, durationMs) {
    return new Promise(resolve => {
        Object.assign(ghostEl.style, {
            position: 'fixed',
            left: srcRect.left + 'px',
            top: srcRect.top + 'px',
            width: srcRect.width + 'px',
            height: srcRect.height + 'px',
            margin: '0',
            zIndex: '70',
            transition: `transform ${durationMs}ms cubic-bezier(.2,.8,.3,1)`,
            pointerEvents: 'none',
        });
        ghostEl.classList.add('fly-ghost');
        document.body.appendChild(ghostEl);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const dx = (dstRect.left + dstRect.width / 2) - (srcRect.left + srcRect.width / 2);
                const dy = (dstRect.top + dstRect.height / 2) - (srcRect.top + srcRect.height / 2);
                const rot = (Math.random() * 16 - 8) | 0;
                ghostEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
            });
        });
        setTimeout(() => { ghostEl.remove(); resolve(); }, durationMs + 20);
    });
}

function rectOf(el) {
    return el.getBoundingClientRect();
}

function animatePlay(seat, card, srcRect) {
    const dstRect = rectOf($('discard-pile'));
    const ghost = cardEl(card);
    return flyCard(srcRect, dstRect, ghost, ANIM_PLAY_MS);
}

function animateDraw(seat) {
    const srcRect = rectOf($('draw-pile'));
    const dstEl = seat === 0 ? $('hand-0') : $(`hand-${seat}`);
    const dstRect = rectOf(dstEl);
    const ghost = cardEl(null, { faceDown: true });
    return flyCard(srcRect, dstRect, ghost, ANIM_DRAW_MS);
}

function animateReshuffle() {
    if (!state.reshufflePending) return Promise.resolve();
    state.reshufflePending = false;
    state.reshuffleAnimating = true;
    render();
    const srcRect = rectOf($('discard-pile'));
    const dstRect = rectOf($('draw-pile'));
    const ghost = cardEl(null, { faceDown: true });
    return flyCard(srcRect, dstRect, ghost, 500).then(() => {
        state.reshuffleAnimating = false;
        if (state.reshuffleCount > 0) {
            logEvent(state, `Reshuffled ${state.reshuffleCount} cards into the draw pile.`);
            state.reshuffleCount = 0;
        }
        render();
    });
}

// Stagger N draw animations from the pile to the seated player. Used for
// Draw Two / Wild Draw Four / Eins challenge penalties.
const DRAW_STAGGER_MS = 90;
function animateDrawN(seat, n) {
    return new Promise(resolve => {
        const runDraws = () => {
            if (n <= 0) {
                resolve();
                return;
            }
            let completed = 0;
            for (let i = 0; i < n; i++) {
                setTimeout(() => {
                    animateDraw(seat).then(() => {
                        completed += 1;
                        if (completed === n) resolve();
                    });
                }, i * DRAW_STAGGER_MS);
            }
        };
        if (state.reshufflePending) {
            animateReshuffle().then(runDraws);
        } else {
            runDraws();
        }
    });
}

function showToast(text, colorClass) {
    const layer = $('toast-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'toast';
    if (colorClass) t.classList.add(`color-${colorClass}`);
    t.textContent = text;
    layer.appendChild(t);
    // Auto-remove after the animation finishes.
    setTimeout(() => { if (t.parentElement) t.remove(); }, 1200);
}

function renderActionButtons() {
    const einsBtn = $('eins-button');
    const chBtn = $('challenge-button');
    const isHumanSeat = state.currentPlayer === 0 && !state.gameOver;

    einsBtn.hidden = false;
    chBtn.hidden = false;

    // Eins arms on the normal pre-play case (your turn, 2 cards) AND on the
    // "late call" grace window — you just played your penultimate card, no
    // one has acted since (lastActor still you), and you haven't called yet.
    const einsArmed = !state.gameOver && !state.einsCalled[0] && (
        (state.currentPlayer === 0 && state.hands[0].length === 2) ||
        (state.lastActor === 0 && state.hands[0].length === 1)
    );
    einsBtn.classList.toggle('armed', einsArmed);
    einsBtn.classList.toggle('disabled', !einsArmed);

    // Challenge is armed whenever there's a valid target, *regardless of whose
    // seat is up* — so during a bot's 2s thinking pause the human can race the
    // bot to the challenge.
    const prev = state.lastActor;
    const validTarget = prev !== null && prev !== 0
        && state.hands[prev].length === 1 && !state.einsCalled[prev];
    const challengeArmed = !state.gameOver && validTarget;
    chBtn.classList.toggle('armed', challengeArmed);
    chBtn.classList.toggle('disabled', state.gameOver);
    chBtn.textContent = challengeArmed
        ? `Challenge ${playerName(prev)}!`
        : 'Challenge';
}

function renderDrawPile() {
    const dp = $('draw-pile');
    const isHumanTurn = state.currentPlayer === 0 && !state.gameOver && !humanInputLocked;
    const canDraw = isHumanTurn && !state.drewThisTurn;
    dp.classList.toggle('disabled', !canDraw);
}

function render() {
    renderOpponent(1);
    renderOpponent(2);
    renderOpponent(3);
    renderPlayer();
    renderDiscard();
    renderPileCounts();
    renderColorIndicator();
    renderDirection();
    renderDrawPile();
    renderActionButtons();
    renderPlayLog();
}

function renderPlayLog() {
    const el = $('play-log');
    if (!el) return;
    el.innerHTML = '';
    // Newest entry on top.
    const recent = state.log.slice(-12).reverse();
    recent.forEach((line, i) => {
        const div = document.createElement('div');
        div.className = 'entry';
        if (i === 0) div.classList.add('latest');
        div.textContent = line;
        el.appendChild(div);
    });
    el.scrollTop = 0;
}

// --- Human actions ---

function onHumanPlay(cardIdx) {
    if (state.currentPlayer !== 0 || state.gameOver || humanInputLocked) return;
    const card = state.hands[0][cardIdx];
    const top = topCard(state);
    if (!canPlay(card, top, state.currentColor)) return;

    const cardElInHand = humanCardElement(card);
    const srcRect = cardElInHand ? rectOf(cardElInHand) : rectOf($('hand-0'));

    if (isWild(card)) {
        state.awaitingColor = true;
        state.pendingWildPlay = { playerIdx: 0, cardIdx };
        showColorModal();
        return;
    }
    humanInputLocked = true;
    if (cardElInHand) cardElInHand.style.visibility = 'hidden';
    animatePlay(0, card, srcRect).then(() => {
        humanInputLocked = false;
        finalizeHumanPlay(cardIdx, null);
    });
}

function finalizeHumanPlay(cardIdx, chosenColor) {
    showEndTurnButton(false);
    const card = state.hands[0][cardIdx];
    const result = executePlay(state, 0, cardIdx, chosenColor);
    logEvent(state, describePlay(0, card, result, chosenColor));
    afterMove(result);
}

async function onHumanDraw() {
    if (state.currentPlayer !== 0 || state.gameOver || humanInputLocked) return;
    if (state.drewThisTurn) return;
    humanInputLocked = true;
    await animateDraw(0);
    humanInputLocked = false;
    const c = drawOne(state);
    if (state.reshufflePending) await animateReshuffle();
    if (!c) {
        renderStatus('Deck empty.', true);
        return;
    }
    state.hands[0].push(c);
    state.einsCalled[0] = false;
    state.drewThisTurn = true;
    state.drawnCardId = c.id;
    syncEinsFlags(state);
    logEvent(state, `You drew a card.`);
    const top = topCard(state);
    const drawnPlayable = canPlay(c, top, state.currentColor);
    const anyPlayable = state.hands[0].some(card => canPlay(card, top, state.currentColor));
    render();
    if (anyPlayable) {
        renderStatus(drawnPlayable
            ? `Drew ${describeCard(c)}. Play any highlighted card, or end your turn.`
            : `Drew ${describeCard(c)} — not playable. Play another highlighted card, or end your turn.`);
        showEndTurnButton(true);
    } else {
        renderStatus(`Drew ${describeCard(c)}. Nothing playable — passing.`);
        humanInputLocked = true;
        setTimeout(() => {
            humanInputLocked = false;
            endHumanTurn();
        }, POST_DRAW_AUTO_END_MS);
    }
}

function endHumanTurn() {
    // Defensive: the button is hidden on every exit path, but never let a
    // stale click advance play out of turn.
    if (state.currentPlayer !== 0 || state.gameOver) { showEndTurnButton(false); return; }
    state.drewThisTurn = false;
    state.drawnCardId = null;
    advance(state);
    showEndTurnButton(false);
    afterMove(null);
}

function afterMove(result) {
    if (result && result.effect && TOAST_LABELS[result.effect]) {
        const colorClass = result.card && !isWild(result.card) ? result.card.color : state.currentColor;
        showToast(TOAST_LABELS[result.effect], colorClass);
    }
    // Chain card (-1) keeps the human's turn going. Make sure input isn't
    // left locked from any prior step.
    if (result && result.playAgain && state.currentPlayer === 0 && !state.gameOver) {
        humanInputLocked = false;
    }
    render();
    if (state.gameOver) {
        announceWinner();
        return;
    }
    honorSkipFlag();
    if (state.gameOver) return;
    if (state.currentPlayer !== 0) {
        scheduleBotTurn();
    } else {
        announceTurn();
    }
}

function announceTurn() {
    const top = topCard(state);
    const hasPlay = state.hands[0].some(c => canPlay(c, top, state.currentColor));
    if (hasPlay) {
        renderStatus(`Your turn — play a card or draw.`);
    } else {
        renderStatus(`Your turn — no playable card, draw one.`);
    }
}

// Eins button:
//   normal case — it's the human's turn AND they currently hold exactly 2 cards
//   late case   — the human just played their penultimate card without calling
//                 Eins AND no one has played or challenged since, so they're
//                 racing to call Eins before the next player acts.
function onHumanCallEins() {
    if (state.gameOver) return;
    if (state.einsCalled[0]) return;
    const handLen = state.hands[0].length;
    const normalCase = state.currentPlayer === 0 && handLen === 2;
    const lateCase = state.lastActor === 0 && handLen === 1;
    if (!normalCase && !lateCase) return;
    state.einsCalled[0] = true;
    logEvent(state, lateCase ? `You called Eins (just in time)!` : `You called Eins!`);
    showToast('Eins!', 'yellow');
    // If we're still in the human's chain after the call, guarantee the play
    // input isn't stuck locked from a stale animation/state.
    if (state.currentPlayer === 0 && !state.gameOver) {
        humanInputLocked = false;
    }
    render();
}

// Challenge button: targets the most recent player to play a card. Can be
// pressed any time during the round (not just on the human's turn) so the
// human can race a bot to the call during the bot's 2s thinking pause.
function onHumanChallenge() {
    if (state.gameOver) return;
    const prev = state.lastActor;
    if (prev === null || prev === 0) return;
    const offenderHand = state.hands[prev].length;
    const offenderCalled = state.einsCalled[prev];
    const wasMyTurn = state.currentPlayer === 0;

    if (offenderCalled || offenderHand > 1) {
        // Bad challenge: 6 cards + lose turn (per design rule 14).
        applyBadChallengePenalty(/*challenger*/ 0, /*accused*/ prev);
        state.lastActor = null;
        if (wasMyTurn) {
            // It was the human's own turn — forfeit it now.
            advance(state);
            render();
            chainNextTurn();
        } else {
            // The challenge was thrown during another seat's pause. Queue the
            // skip for whenever the human's turn would next come up.
            state.skipNextTurn[0] = true;
            render();
        }
        return;
    }

    // Good challenge: offender draws 6.
    applyChallengePenalty(/*offender*/ prev, /*challenger*/ 0);
    state.lastActor = null;
    render();
    if (wasMyTurn) announceTurn();
}

function applyChallengePenalty(offenderIdx, challengerIdx) {
    drawN(state, offenderIdx, 6);
    animateDrawN(offenderIdx, 6);
    syncEinsFlags(state);
    logEvent(state, `${playerName(challengerIdx)} challenged ${playerName(offenderIdx)} — +6 cards.`);
    showToast(`${playerName(offenderIdx)} +6`, 'red');
    renderStatus(`${playerName(challengerIdx)} challenged ${playerName(offenderIdx)} for not calling Eins. ${playerName(offenderIdx)} draws 6.`, true);
}

function applyBadChallengePenalty(challengerIdx, accusedIdx) {
    drawN(state, challengerIdx, 6);
    animateDrawN(challengerIdx, 6);
    syncEinsFlags(state);
    logEvent(state, `${playerName(challengerIdx)} challenged ${playerName(accusedIdx)} — bad call, +6 cards, loses turn.`);
    showToast(`${playerName(challengerIdx)} +6 · skipped`, 'red');
    renderStatus(`Bad challenge — ${playerName(challengerIdx)} draws 6 and loses their turn.`, true);
}

// Consume any "lose your turn" flags before handing control to the current
// player. Each flag is one-shot and clears as it's honored.
function honorSkipFlag() {
    while (!state.gameOver && state.skipNextTurn[state.currentPlayer]) {
        const skipped = state.currentPlayer;
        state.skipNextTurn[skipped] = false;
        logEvent(state, `${playerName(skipped)} ${skipped === 0 ? 'lose' : 'loses'} their turn (bad challenge).`);
        showToast(`${playerName(skipped)} skipped`, 'red');
        advance(state);
    }
}

function announceWinner() {
    showColorModal(false);
    showEndTurnButton(false);
    const w = state.winner;
    const result = state.lastRoundResult;
    const tournamentDone = state.tournamentWinner !== null;
    const lines = [];

    if (tournamentDone) {
        const tw = state.tournamentWinner;
        lines.push(tw === 0
            ? `You won the tournament with ${state.tournamentScores[tw]} points!`
            : `${playerName(tw)} won the tournament with ${state.tournamentScores[tw]} points.`);
        lines.push('');
    }
    lines.push(w === 0
        ? `You won round ${state.roundNumber} — +${result.points} points.`
        : `${playerName(w)} (${state.strategies[w]} strategy) won round ${state.roundNumber} — +${result.points} points.`);
    lines.push('');
    lines.push('Round breakdown:');
    for (const b of result.breakdown) {
        lines.push(`  ${playerName(b.idx)}: ${b.cards} card${b.cards === 1 ? '' : 's'} (${b.points} pts)`);
    }
    lines.push('');
    lines.push('Tournament totals (first to 500 wins):');
    for (let i = 0; i < NUM_PLAYERS; i++) {
        lines.push(`  ${playerName(i)}: ${state.tournamentScores[i]}`);
    }

    const title = tournamentDone
        ? (state.tournamentWinner === 0 ? 'Tournament won!' : `${playerName(state.tournamentWinner)} won the tournament`)
        : (w === 0 ? 'You win the round!' : `${playerName(w)} wins the round`);
    showResultModal(title, lines.join('\n'));
    const btn = $('result-new-game');
    btn.textContent = tournamentDone ? 'New Tournament' : 'Next Round';
}

// --- Bot turn ---

function scheduleBotTurn() {
    humanInputLocked = true;
    render();
    const seat = state.currentPlayer;
    renderStatus(`${playerName(seat)} is thinking…`);
    setTimeout(() => doBotTurn(), BOT_DELAY_MS);
}

function doBotTurn() {
    if (state.gameOver) { humanInputLocked = false; return; }
    const seat = state.currentPlayer;

    // Auto-challenge: if the previous player has 1 card and didn't call Eins,
    // bots always seize the chance to penalize them.
    const prev = state.lastActor;
    if (prev !== null && prev !== seat
        && state.hands[prev].length === 1 && !state.einsCalled[prev]) {
        applyChallengePenalty(prev, seat);
        state.lastActor = null;
        render();
        setTimeout(() => { if (!state.gameOver) doBotTurn(); }, BOT_DELAY_MS);
        return;
    }

    const idx = botChoosePlay(state, seat);
    if (idx !== null) {
        const card = state.hands[seat][idx];
        if (state.hands[seat].length === 2 && !state.einsCalled[seat]
            && Math.random() < BOT_EINS_REMEMBER) {
            state.einsCalled[seat] = true;
            logEvent(state, `${playerName(seat)} called Eins!`);
            showToast('Eins!', 'yellow');
        }
        let chosenColor = null;
        if (isWild(card)) {
            chosenColor = pickWildColor(state.hands[seat], state.currentColor,
                !opponentAboutToWin(state, seat));
        }
        const handArea = $(`hand-${seat}`);
        const srcRect = rectOf(handArea);
        const flightCard = isWild(card) ? { ...card, color: chosenColor } : card;
        animatePlay(seat, flightCard, srcRect).then(() => {
            const result = executePlay(state, seat, idx, chosenColor);
            logEvent(state, describePlay(seat, card, result, chosenColor));
            renderStatus(`${playerName(seat)} played ${describeCard(card)}${chosenColor ? ` — ${chosenColor}` : ''}.`);
            if (result.effect && TOAST_LABELS[result.effect]) {
                const colorClass = !isWild(card) ? card.color : state.currentColor;
                showToast(TOAST_LABELS[result.effect], colorClass);
            }
            render();
            if (state.gameOver) { announceWinner(); return; }
            if (result.playAgain) {
                // -1 chain: same bot plays again.
                setTimeout(() => doBotTurn(), 600);
                return;
            }
            chainNextTurn();
        });
        return;
    }
    // No playable: animate a draw, then maybe play.
    animateDraw(seat).then(async () => {
        const drawn = drawOne(state);
        if (state.reshufflePending) await animateReshuffle();
        if (!drawn) {
            logEvent(state, `${playerName(seat)} drew nothing — deck empty.`);
            renderStatus(`Deck empty. ${playerName(seat)} passes.`);
            advance(state);
            chainNextTurn();
            return;
        }
        state.hands[seat].push(drawn);
        state.einsCalled[seat] = false;
        syncEinsFlags(state);
        logEvent(state, `${playerName(seat)} drew a card.`);
        renderStatus(`${playerName(seat)} drew a card.`);
        render();
        const top = topCard(state);
        if (canPlay(drawn, top, state.currentColor)) {
            const strat = state.strategies[seat];
            const playIt = strat === 'offensive' || !['wild4', 'wild6', 'draw2'].includes(drawn.value);
            if (playIt) {
                setTimeout(() => {
                    if (state.gameOver) { humanInputLocked = false; return; }
                    const cardIdx = state.hands[seat].indexOf(drawn);
                    if (cardIdx === -1) { advance(state); chainNextTurn(); return; }
                    if (state.hands[seat].length === 2 && !state.einsCalled[seat]
                        && Math.random() < BOT_EINS_REMEMBER) {
                        state.einsCalled[seat] = true;
                        logEvent(state, `${playerName(seat)} called Eins!`);
                        showToast('Eins!', 'yellow');
                    }
                    let chosenColor = null;
                    if (isWild(drawn)) {
                        chosenColor = pickWildColor(state.hands[seat], state.currentColor,
                            !opponentAboutToWin(state, seat));
                    }
                    const handArea = $(`hand-${seat}`);
                    const srcRect = rectOf(handArea);
                    const flightCard = isWild(drawn) ? { ...drawn, color: chosenColor } : drawn;
                    animatePlay(seat, flightCard, srcRect).then(() => {
                        const result = executePlay(state, seat, cardIdx, chosenColor);
                        logEvent(state, describePlay(seat, drawn, result, chosenColor));
                        renderStatus(`${playerName(seat)} played ${describeCard(drawn)}.`);
                        if (result.effect && TOAST_LABELS[result.effect]) {
                            const colorClass = !isWild(drawn) ? drawn.color : state.currentColor;
                            showToast(TOAST_LABELS[result.effect], colorClass);
                        }
                        render();
                        if (state.gameOver) { announceWinner(); return; }
                        if (result.playAgain) {
                            setTimeout(() => doBotTurn(), 600);
                            return;
                        }
                        chainNextTurn();
                    });
                }, BOT_DELAY_MS / 2);
                return;
            }
        }
        advance(state);
        chainNextTurn();
    });
}

function chainNextTurn() {
    if (state.gameOver) { humanInputLocked = false; return; }
    honorSkipFlag();
    if (state.gameOver) { humanInputLocked = false; return; }
    if (state.currentPlayer !== 0) {
        // Bots get a 2s pre-turn pause for thinking — also the window during
        // which they may auto-challenge a missed Eins.
        setTimeout(() => doBotTurn(), BOT_DELAY_MS);
    } else {
        // Human plays immediately; they can challenge any time during their turn.
        humanInputLocked = false;
        render();
        announceTurn();
    }
}

// --- Modals & buttons ---

function showColorModal(show = true) {
    const modal = $('color-modal');
    modal.classList.toggle('hidden', !show);
    if (show) {
        $('cancel-color').focus();
    }
}

function cancelWildPlay() {
    state.awaitingColor = false;
    state.pendingWildPlay = null;
    showColorModal(false);
    humanInputLocked = false;
    render();
    const card = state.hands[0].find(c => isWild(c));
    if (card) {
        const cardElInHand = [...$('hand-0').children].find(el => el.getAttribute('aria-label')?.startsWith(describeCard(card)));
        if (cardElInHand) cardElInHand.focus();
    }
}

function showResultModal(title, body) {
    $('result-title').textContent = title;
    $('result-body').textContent = body;
    $('result-modal').classList.remove('hidden');
}

function hideResultModal() {
    $('result-modal').classList.add('hidden');
}

let endTurnBtn = null;
function showEndTurnButton(show) {
    if (!endTurnBtn) {
        endTurnBtn = document.createElement('button');
        endTurnBtn.className = 'btn primary';
        endTurnBtn.textContent = 'End Turn';
        endTurnBtn.style.marginLeft = '8px';
        endTurnBtn.addEventListener('click', endHumanTurn);
        $('status').parentElement.appendChild(endTurnBtn);
    }
    endTurnBtn.style.display = show ? 'inline-block' : 'none';
}

// --- Events ---

function announceStarter() {
    const starter = state.startingPlayer;
    const text = starter === 0 ? 'You start!' : `${state.botNames[starter]} starts!`;
    showToast(text);
}

function startNewGame() {
    // Always-fresh tournament: clear scores + round number.
    state = newGame(null);
    humanInputLocked = false;
    showEndTurnButton(false);
    hideResultModal();
    showColorModal(false);
    render();
    announceStarter();
    if (state.openingMessages && state.openingMessages.length) {
        renderStatus(state.openingMessages.join(' '));
    }
    if (state.currentPlayer !== 0) {
        scheduleBotTurn();
    } else {
        announceTurn();
    }
}

function startNextRound() {
    // Continue the current tournament, unless it's already been won.
    const continuing = state && state.tournamentWinner === null ? state : null;
    state = newGame(continuing);
    humanInputLocked = false;
    showEndTurnButton(false);
    hideResultModal();
    showColorModal(false);
    render();
    announceStarter();
    if (state.openingMessages && state.openingMessages.length) {
        renderStatus(state.openingMessages.join(' '));
    }
    if (state.currentPlayer !== 0) {
        scheduleBotTurn();
    } else {
        announceTurn();
    }
}

function attachEvents() {
    // --fan-max changes at viewport breakpoints, so re-render on resize and
    // orientation change to keep the fans matching the space CSS reserved.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (state) render(); }, 150);
    });

    $('new-game').addEventListener('click', startNewGame);
    $('result-new-game').addEventListener('click', startNextRound);
    $('draw-pile').addEventListener('click', onHumanDraw);
    $('eins-button').addEventListener('click', onHumanCallEins);
    $('challenge-button').addEventListener('click', onHumanChallenge);
    $('cancel-color').addEventListener('click', cancelWildPlay);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !$('color-modal').classList.contains('hidden')) {
            event.preventDefault();
            cancelWildPlay();
        }
    });
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            showColorModal(false);
            if (state.pendingWildPlay) {
                const { cardIdx } = state.pendingWildPlay;
                state.pendingWildPlay = null;
                state.awaitingColor = false;
                const card = state.hands[0][cardIdx];
                const cardElInHand = humanCardElement(card);
                const srcRect = cardElInHand ? rectOf(cardElInHand) : rectOf($('hand-0'));
                if (cardElInHand) cardElInHand.style.visibility = 'hidden';
                humanInputLocked = true;
                animatePlay(0, { ...card, color }, srcRect).then(() => {
                    humanInputLocked = false;
                    finalizeHumanPlay(cardIdx, color);
                });
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    attachEvents();
    startNewGame();
});

})();
