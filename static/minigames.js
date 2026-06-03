// ═══════════════════════════════════════════════════════════
//  🎮 MINI GAMES - Complete Implementation
// ═══════════════════════════════════════════════════════════

let currentGameTimer = null;
let currentGameStartTime = 0;
let currentGameScore = 0;
let currentGameName = '';

// ═══ Game Launch Function ═══
function launchGame(gameName) {
    currentGameName = gameName;
    currentGameStartTime = Date.now();
    currentGameScore = 0;
    
    const modal = document.createElement('div');
    modal.className = 'game-modal';
    modal.id = 'gameModal';
    modal.innerHTML = `
        <div class="game-modal-content">
            <div class="game-modal-header">
                <h2 id="gameTitle"></h2>
                <div class="game-timer">⏱️ <span id="gameTimer">0:00</span></div>
                <button class="close-game-btn" onclick="closeGame()">✕</button>
            </div>
            <div class="game-canvas" id="gameCanvas"></div>
            <div class="game-score">Score: <span id="currentScore">0</span></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    startGameTimer();
    
    // Launch specific game
    switch(gameName) {
        case 'sudoku': initSudoku(); break;
        case 'memory': initMemory(); break;
        case '2048': init2048(); break;
        case 'word_hunt': initWordHunt(); break;
        case 'math_blitz': initMathBlitz(); break;
        case 'color_match': initColorMatch(); break;
        case 'reaction': initReaction(); break;
        case 'simon': initSimon(); break;
        case 'typing': initTyping(); break;
        case 'quiz': initQuiz(); break;
    }
}

function startGameTimer() {
    currentGameTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - currentGameStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('gameTimer').textContent = 
            `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function updateScore(points) {
    currentGameScore += points;
    document.getElementById('currentScore').textContent = currentGameScore;
}

function closeGame() {
    if (currentGameTimer) clearInterval(currentGameTimer);
    const modal = document.getElementById('gameModal');
    if (modal) modal.remove();
}

async function endGameSession(won = false) {
    const timeTaken = Math.floor((Date.now() - currentGameStartTime) / 1000);
    const timeBonus = Math.max(0, Math.floor((300 - timeTaken) / 10) * 10);
    const finalScore = currentGameScore + timeBonus;
    
    // Save to server
    try {
        await fetch('/api/games/scores', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                game: currentGameName,
                score: finalScore,
                time: timeTaken
            })
        });
    } catch(e) {
        console.log('Score save failed:', e);
    }
    
    // Show result
    showGameResult(won, finalScore, timeTaken);
    
    // Add XP
    if (typeof trackAction !== 'undefined') {
        trackAction('game_completed');
        if (typeof gamification !== 'undefined') {
            gamification.addXP(Math.floor(finalScore / 10), `${currentGameName} game`);
        }
    }
}

function showGameResult(won, score, time) {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="game-result ${won ? 'won' : 'lost'}">
            <div class="result-icon">${won ? '🎉' : '😢'}</div>
            <h2>${won ? 'Victory!' : 'Game Over'}</h2>
            <div class="result-stats">
                <div class="stat">
                    <span class="stat-label">Score</span>
                    <span class="stat-value">${score}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Time</span>
                    <span class="stat-value">${mins}:${secs.toString().padStart(2, '0')}</span>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn-primary" onclick="launchGame('${currentGameName}')">Play Again</button>
                <button class="btn-outline" onclick="closeGame()">Close</button>
            </div>
        </div>
    `;
    if (won) gamification.createConfetti();
}

// ═══════════════════════════════════════════════════════════
//  🎯 GAME 1: SUDOKU (4x4 Simplified)
// ═══════════════════════════════════════════════════════════
function initSudoku() {
    document.getElementById('gameTitle').textContent = '🎯 Sudoku 4x4';
    const board = generateSudoku4x4();
    const canvas = document.getElementById('gameCanvas');
    
    let html = '<div class="sudoku-board">';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const value = board[r][c];
            const isFixed = value !== 0;
            html += `
                <input type="number" min="1" max="4" 
                    class="sudoku-cell ${isFixed ? 'fixed' : ''}" 
                    value="${value || ''}" 
                    ${isFixed ? 'readonly' : ''}
                    data-row="${r}" data-col="${c}"
                    onchange="checkSudoku()">
            `;
        }
    }
    html += '</div>';
    canvas.innerHTML = html;
    window.sudokuSolution = solveSudoku4x4Board(JSON.parse(JSON.stringify(board)));
}

function generateSudoku4x4() {
    const board = [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 3, 4, 1],
        [4, 1, 2, 3]
    ];
    // Remove some numbers
    const toRemove = 8;
    let removed = 0;
    while (removed < toRemove) {
        const r = Math.floor(Math.random() * 4);
        const c = Math.floor(Math.random() * 4);
        if (board[r][c] !== 0) {
            board[r][c] = 0;
            removed++;
        }
    }
    return board;
}

function solveSudoku4x4Board(board) {
    // Return pre-solved for simplicity
    return [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 3, 4, 1],
        [4, 1, 2, 3]
    ];
}

function checkSudoku() {
    const cells = document.querySelectorAll('.sudoku-cell:not(.fixed)');
    let filled = true;
    let correct = true;
    
    cells.forEach(cell => {
        const val = parseInt(cell.value);
        if (!val) filled = false;
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        if (val && val !== window.sudokuSolution[r][c]) correct = false;
    });
    
    if (filled && correct) {
        updateScore(1000);
        endGameSession(true);
    }
}

// ═══════════════════════════════════════════════════════════
//  🃏 GAME 2: MEMORY MATCH
// ═══════════════════════════════════════════════════════════
function initMemory() {
    document.getElementById('gameTitle').textContent = '🃏 Memory Match';
    const emojis = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    
    let flipped = [];
    let matched = 0;
    
    let html = '<div class="memory-grid">';
    cards.forEach((emoji, i) => {
        html += `
            <div class="memory-card" data-index="${i}" data-emoji="${emoji}" 
                 onclick="flipMemoryCard(${i})">
                <div class="card-inner">
                    <div class="card-front">?</div>
                    <div class="card-back">${emoji}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    document.getElementById('gameCanvas').innerHTML = html;
    
    window.memoryGame = { flipped, matched, cards };
}

function flipMemoryCard(index) {
    const game = window.memoryGame;
    if (game.flipped.length >= 2) return;
    
    const card = document.querySelector(`.memory-card[data-index="${index}"]`);
    if (card.classList.contains('flipped')) return;
    
    card.classList.add('flipped');
    game.flipped.push(index);
    
    if (game.flipped.length === 2) {
        const [i1, i2] = game.flipped;
        const emoji1 = game.cards[i1];
        const emoji2 = game.cards[i2];
        
        setTimeout(() => {
            if (emoji1 === emoji2) {
                game.matched += 2;
                updateScore(100);
                if (game.matched === game.cards.length) {
                    updateScore(500);
                    endGameSession(true);
                }
            } else {
                document.querySelector(`.memory-card[data-index="${i1}"]`).classList.remove('flipped');
                document.querySelector(`.memory-card[data-index="${i2}"]`).classList.remove('flipped');
            }
            game.flipped = [];
        }, 800);
    }
}

// ═══════════════════════════════════════════════════════════
//  🎲 GAME 3: 2048 (Simplified 3x3)
// ═══════════════════════════════════════════════════════════
function init2048() {
    document.getElementById('gameTitle').textContent = '🎲 2048';
    const board = Array(3).fill().map(() => Array(3).fill(0));
    addNew2048Tile(board);
    addNew2048Tile(board);
    
    render2048(board);
    
    document.addEventListener('keydown', handle2048Key);
    window.game2048 = { board };
}

function addNew2048Tile(board) {
    const empty = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (board[r][c] === 0) empty.push([r, c]);
        }
    }
    if (empty.length) {
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
}

function render2048(board) {
    let html = '<div class="game-2048-board">';
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const val = board[r][c];
            html += `<div class="tile-2048 tile-${val}">${val || ''}</div>`;
        }
    }
    html += '</div><div style="text-align:center;margin-top:1rem;color:#666;">Use arrow keys to play</div>';
    document.getElementById('gameCanvas').innerHTML = html;
}

function handle2048Key(e) {
    if (!window.game2048) return;
    const { board } = window.game2048;
    let moved = false;
    
    if (e.key === 'ArrowLeft') moved = move2048Left(board);
    else if (e.key === 'ArrowRight') moved = move2048Right(board);
    else if (e.key === 'ArrowUp') moved = move2048Up(board);
    else if (e.key === 'ArrowDown') moved = move2048Down(board);
    
    if (moved) {
        addNew2048Tile(board);
        render2048(board);
        const maxTile = Math.max(...board.flat());
        updateScore(maxTile);
        if (maxTile >= 128) {
            document.removeEventListener('keydown', handle2048Key);
            endGameSession(true);
        }
    }
}

function move2048Left(board) {
    let moved = false;
    for (let r = 0; r < 3; r++) {
        const row = board[r].filter(x => x !== 0);
        for (let i = 0; i < row.length - 1; i++) {
            if (row[i] === row[i + 1]) {
                row[i] *= 2;
                row.splice(i + 1, 1);
            }
        }
        while (row.length < 3) row.push(0);
        if (JSON.stringify(row) !== JSON.stringify(board[r])) moved = true;
        board[r] = row;
    }
    return moved;
}

function move2048Right(board) {
    board.forEach(row => row.reverse());
    const moved = move2048Left(board);
    board.forEach(row => row.reverse());
    return moved;
}

function move2048Up(board) {
    const rotated = board[0].map((_, i) => board.map(row => row[i]));
    const moved = move2048Left(rotated);
    for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
            board[r][c] = rotated[c][r];
        }
    }
    return moved;
}

function move2048Down(board) {
    const rotated = board[0].map((_, i) => board.map(row => row[i]));
    rotated.forEach(row => row.reverse());
    const moved = move2048Left(rotated);
    rotated.forEach(row => row.reverse());
    for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
            board[r][c] = rotated[c][r];
        }
    }
    return moved;
}

// ═══════════════════════════════════════════════════════════
//  📝 GAME 4: WORD HUNT
// ═══════════════════════════════════════════════════════════
function initWordHunt() {
    document.getElementById('gameTitle').textContent = '📝 Word Hunt';
    const words = ['CODE', 'GAME', 'PLAY', 'WORK', 'TECH', 'DATA'];
    const target = words[Math.floor(Math.random() * words.length)];
    const scrambled = target.split('').sort(() => Math.random() - 0.5).join('');
    
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="word-hunt-game">
            <div class="scrambled-word">${scrambled}</div>
            <p>Unscramble the letters!</p>
            <input type="text" id="wordInput" placeholder="Your answer" maxlength="${target.length}" 
                   style="padding:1rem;font-size:1.2rem;text-align:center;width:200px;text-transform:uppercase;">
            <button class="btn-primary" onclick="checkWord('${target}')">Submit</button>
        </div>
    `;
    document.getElementById('wordInput').focus();
}

function checkWord(target) {
    const input = document.getElementById('wordInput').value.toUpperCase();
    if (input === target) {
        updateScore(500);
        endGameSession(true);
    } else {
        gamification.showToast('❌ Try again!', 1000);
    }
}

// ═══════════════════════════════════════════════════════════
//  ➕ GAME 5: MATH BLITZ
// ═══════════════════════════════════════════════════════════
function initMathBlitz() {
    document.getElementById('gameTitle').textContent = '➕ Math Blitz';
    window.mathBlitzScore = 0;
    window.mathBlitzRound = 0;
    nextMathQuestion();
}

function nextMathQuestion() {
    if (window.mathBlitzRound >= 10) {
        endGameSession(true);
        return;
    }
    
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    
    let answer;
    if (op === '+') answer = a + b;
    else if (op === '-') answer = a - b;
    else answer = a * b;
    
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="math-blitz-game">
            <div class="math-question">${a} ${op} ${b} = ?</div>
            <input type="number" id="mathAnswer" placeholder="Answer" 
                   style="padding:1rem;font-size:1.2rem;text-align:center;width:150px;">
            <button class="btn-primary" onclick="checkMath(${answer})">Submit</button>
            <div style="margin-top:1rem;color:#666;">Question ${window.mathBlitzRound + 1}/10</div>
        </div>
    `;
    document.getElementById('mathAnswer').focus();
}

function checkMath(answer) {
    const input = parseInt(document.getElementById('mathAnswer').value);
    if (input === answer) {
        updateScore(100);
        window.mathBlitzRound++;
        gamification.showToast('✅ Correct!', 800);
        setTimeout(nextMathQuestion, 800);
    } else {
        gamification.showToast('❌ Wrong!', 1000);
    }
}

// ═══════════════════════════════════════════════════════════
//  🎨 GAME 6: COLOR MATCH
// ═══════════════════════════════════════════════════════════
function initColorMatch() {
    document.getElementById('gameTitle').textContent = '🎨 Color Match';
    window.colorMatchScore = 0;
    window.colorMatchRound = 0;
    nextColorQuestion();
}

function nextColorQuestion() {
    if (window.colorMatchRound >= 10) {
        endGameSession(true);
        return;
    }
    
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const colorNames = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE'];
    const textColor = colors[Math.floor(Math.random() * colors.length)];
    const wordColor = colors[Math.floor(Math.random() * colors.length)];
    const word = colorNames[colors.indexOf(wordColor)];
    
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="color-match-game">
            <p>What COLOR is this text? (Not the word)</p>
            <div class="color-word" style="color:${textColor};font-size:3rem;font-weight:bold;">${word}</div>
            <div class="color-options">
                ${colors.map(c => `
                    <button class="color-btn" style="background:${c}" 
                            onclick="checkColor('${c}', '${textColor}')">
                        ${c.toUpperCase()}
                    </button>
                `).join('')}
            </div>
            <div style="margin-top:1rem;color:#666;">Round ${window.colorMatchRound + 1}/10</div>
        </div>
    `;
}

function checkColor(selected, correct) {
    if (selected === correct) {
        updateScore(100);
        window.colorMatchRound++;
        gamification.showToast('✅ Correct!', 600);
        setTimeout(nextColorQuestion, 600);
    } else {
        gamification.showToast('❌ Wrong color!', 1000);
    }
}

// ═══════════════════════════════════════════════════════════
//  ⚡ GAME 7: REACTION TIME
// ═══════════════════════════════════════════════════════════
function initReaction() {
    document.getElementById('gameTitle').textContent = '⚡ Reaction Time';
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="reaction-game">
            <div class="reaction-box" id="reactionBox" onclick="reactionClick()">
                <p>Wait for GREEN...</p>
            </div>
            <div id="reactionResult"></div>
        </div>
    `;
    
    setTimeout(() => {
        const box = document.getElementById('reactionBox');
        box.style.background = '#22c55e';
        box.innerHTML = '<p style="color:white;">CLICK NOW!</p>';
        window.reactionStartTime = Date.now();
    }, Math.random() * 3000 + 2000);
}

function reactionClick() {
    if (!window.reactionStartTime) {
        gamification.showToast('⚠️ Too early! Wait for green.', 1500);
        return;
    }
    
    const time = Date.now() - window.reactionStartTime;
    const score = Math.max(0, 1000 - time);
    updateScore(score);
    
    document.getElementById('reactionResult').innerHTML = `
        <h3>Reaction Time: ${time}ms</h3>
        <p>Score: ${score}</p>
    `;
    
    setTimeout(() => endGameSession(true), 2000);
}

// ═══════════════════════════════════════════════════════════
//  🔵 GAME 8: SIMON SAYS
// ═══════════════════════════════════════════════════════════
function initSimon() {
    document.getElementById('gameTitle').textContent = '🔵 Simon Says';
    window.simonSequence = [];
    window.simonUserSeq = [];
    window.simonRound = 0;
    
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="simon-game">
            <div class="simon-board">
                <div class="simon-btn" data-color="0" style="background:#ef4444" onclick="simonClick(0)"></div>
                <div class="simon-btn" data-color="1" style="background:#3b82f6" onclick="simonClick(1)"></div>
                <div class="simon-btn" data-color="2" style="background:#22c55e" onclick="simonClick(2)"></div>
                <div class="simon-btn" data-color="3" style="background:#eab308" onclick="simonClick(3)"></div>
            </div>
            <div id="simonMsg">Watch the pattern...</div>
        </div>
    `;
    
    nextSimonRound();
}

function nextSimonRound() {
    window.simonRound++;
    window.simonSequence.push(Math.floor(Math.random() * 4));
    window.simonUserSeq = [];
    document.getElementById('simonMsg').textContent = `Round ${window.simonRound}`;
    playSimonSequence();
}

function playSimonSequence() {
    let i = 0;
    const interval = setInterval(() => {
        if (i >= window.simonSequence.length) {
            clearInterval(interval);
            document.getElementById('simonMsg').textContent = 'Your turn!';
            return;
        }
        flashSimonButton(window.simonSequence[i]);
        i++;
    }, 800);
}

function flashSimonButton(color) {
    const btn = document.querySelector(`.simon-btn[data-color="${color}"]`);
    btn.style.filter = 'brightness(1.5)';
    setTimeout(() => btn.style.filter = 'brightness(1)', 400);
}

function simonClick(color) {
    flashSimonButton(color);
    window.simonUserSeq.push(color);
    
    const index = window.simonUserSeq.length - 1;
    if (window.simonUserSeq[index] !== window.simonSequence[index]) {
        document.getElementById('simonMsg').textContent = 'Wrong! Game Over';
        setTimeout(() => endGameSession(false), 1500);
        return;
    }
    
    if (window.simonUserSeq.length === window.simonSequence.length) {
        updateScore(100 * window.simonRound);
        if (window.simonRound >= 5) {
            document.getElementById('simonMsg').textContent = 'You Win!';
            setTimeout(() => endGameSession(true), 1500);
        } else {
            setTimeout(nextSimonRound, 1000);
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  ⌨️ GAME 9: TYPE RACER
// ═══════════════════════════════════════════════════════════
function initTyping() {
    document.getElementById('gameTitle').textContent = '⌨️ Type Racer';
    const sentences = [
        'The quick brown fox jumps over the lazy dog',
        'Practice makes perfect and perfect makes champion',
        'Never give up on your dreams and aspirations',
        'Success is the sum of small efforts repeated daily'
    ];
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="typing-game">
            <div class="target-text">${sentence}</div>
            <textarea id="typingInput" placeholder="Start typing..." 
                      style="width:100%;height:100px;padding:1rem;font-size:1rem;"
                      oninput="checkTyping('${sentence}')"></textarea>
            <div id="typingStats">WPM: 0 | Accuracy: 100%</div>
        </div>
    `;
    document.getElementById('typingInput').focus();
    window.typingStartTime = Date.now();
}

function checkTyping(target) {
    const input = document.getElementById('typingInput').value;
    const elapsed = (Date.now() - window.typingStartTime) / 1000 / 60;
    const words = input.split(' ').length;
    const wpm = Math.floor(words / elapsed);
    
    let correct = 0;
    for (let i = 0; i < Math.min(input.length, target.length); i++) {
        if (input[i] === target[i]) correct++;
    }
    const accuracy = Math.floor((correct / target.length) * 100);
    
    document.getElementById('typingStats').textContent = 
        `WPM: ${wpm} | Accuracy: ${accuracy}%`;
    
    if (input === target) {
        const score = wpm * 10 + accuracy * 5;
        updateScore(score);
        endGameSession(true);
    }
}

// ═══════════════════════════════════════════════════════════
//  🧠 GAME 10: BRAIN QUIZ
// ═══════════════════════════════════════════════════════════
function initQuiz() {
    document.getElementById('gameTitle').textContent = '🧠 Brain Quiz';
    window.quizScore = 0;
    window.quizRound = 0;
    window.quizQuestions = [
        {q: 'What is 2+2?', a: ['3', '4', '5', '6'], c: 1},
        {q: 'Capital of France?', a: ['London', 'Paris', 'Berlin', 'Madrid'], c: 1},
        {q: 'Largest planet?', a: ['Earth', 'Mars', 'Jupiter', 'Saturn'], c: 2},
        {q: '10 x 10 = ?', a: ['10', '50', '100', '1000'], c: 2},
        {q: 'Who painted Mona Lisa?', a: ['Picasso', 'Da Vinci', 'Van Gogh', 'Monet'], c: 1}
    ];
    nextQuizQuestion();
}

function nextQuizQuestion() {
    if (window.quizRound >= window.quizQuestions.length) {
        endGameSession(true);
        return;
    }
    
    const q = window.quizQuestions[window.quizRound];
    const canvas = document.getElementById('gameCanvas');
    canvas.innerHTML = `
        <div class="quiz-game">
            <h3>${q.q}</h3>
            <div class="quiz-options">
                ${q.a.map((ans, i) => `
                    <button class="quiz-option" onclick="checkQuiz(${i}, ${q.c})">
                        ${ans}
                    </button>
                `).join('')}
            </div>
            <div style="margin-top:1rem;color:#666;">Question ${window.quizRound + 1}/${window.quizQuestions.length}</div>
        </div>
    `;
}

function checkQuiz(selected, correct) {
    if (selected === correct) {
        updateScore(200);
        gamification.showToast('✅ Correct!', 800);
        window.quizRound++;
        setTimeout(nextQuizQuestion, 800);
    } else {
        gamification.showToast('❌ Wrong!', 1000);
        setTimeout(() => endGameSession(false), 1500);
    }
}

// ═══════════════════════════════════════════════════════════
//  📊 LEADERBOARD FUNCTIONS
// ═══════════════════════════════════════════════════════════
function switchLeaderboard(scope) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    loadLeaderboard(scope);
}

async function loadLeaderboard(scope = 'world') {
    const content = document.getElementById('leaderboardContent');
    content.innerHTML = '<p style="text-align:center;padding:2rem;">Loading...</p>';
    
    try {
        const res = await fetch(`/api/games/leaderboard/all?scope=${scope}`);
        const data = await res.json();
        
        let html = '<div class="leaderboard-list">';
        data.slice(0, 50).forEach((entry, i) => {
            html += `
                <div class="leaderboard-entry">
                    <span class="rank">#${i + 1}</span>
                    <span class="player">${entry.username}</span>
                    <span class="score">${entry.score} pts</span>
                    <span class="time">${formatTime(entry.time_taken)}</span>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    } catch(e) {
        content.innerHTML = '<p style="text-align:center;color:#dc2626;">Failed to load leaderboard</p>';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('gamesTab')) {
        loadLeaderboard('world');
    }
});
