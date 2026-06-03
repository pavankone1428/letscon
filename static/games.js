// ═══════════════════════════════════════════════════════════
//  🎮 MINI GAMES SYSTEM - 10 Fun Games with Global Leaderboards
// ═══════════════════════════════════════════════════════════

// Global game state
const GAMES = {
    SUDOKU: 'sudoku',
    MEMORY: 'memory',
    SNAKE: 'snake',
    TETRIS: 'tetris',
    PUZZLE_2048: '2048',
    WORD_HUNT: 'word_hunt',
    MATH_BLITZ: 'math_blitz',
    COLOR_MATCH: 'color_match',
    REACTION_TIME: 'reaction_time',
    BLOCK_BREAKER: 'block_breaker'
};

let currentGame = null;
let gameTimer = null;
let gameStartTime = 0;
let gameScore = 0;
let dailyStreak = parseInt(localStorage.getItem('gamesStreak')) || 0;
let lastPlayedDate = localStorage.getItem('lastGameDate') || '';

// ═══════════════════════════════════════════════════════════
//  📊 LEADERBOARD SYSTEM
// ═══════════════════════════════════════════════════════════

class LeaderboardManager {
    constructor() {
        this.scores = JSON.parse(localStorage.getItem('gameScores')) || {};
    }

    saveScore(game, score, time, userId, username, location) {
        const key = `${game}_${userId}`;
        const entry = {
            userId,
            username,
            score,
            time,
            location: location || { country: 'Unknown', region: 'Unknown' },
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };

        if (!this.scores[game]) this.scores[game] = [];
        
        // Update or add score
        const existingIndex = this.scores[game].findIndex(s => s.userId === userId);
        if (existingIndex >= 0) {
            if (score > this.scores[game][existingIndex].score) {
                this.scores[game][existingIndex] = entry;
            }
        } else {
            this.scores[game].push(entry);
        }

        // Sort by score (descending) and time (ascending)
        this.scores[game].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.time - b.time;
        });

        localStorage.setItem('gameScores', JSON.stringify(this.scores));
        
        // Send to server
        this.syncToServer(game, entry);
    }

    async syncToServer(game, entry) {
        try {
            await fetch('/api/games/score', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ game, ...entry })
            });
        } catch (e) {
            console.log('Score will sync later:', e);
        }
    }

    getTopScores(game, limit = 100) {
        return (this.scores[game] || []).slice(0, limit);
    }

    getUserRank(game, userId) {
        const scores = this.scores[game] || [];
        const index = scores.findIndex(s => s.userId === userId);
        return index >= 0 ? index + 1 : null;
    }

    getRegionalRanking(game, region) {
        const scores = this.scores[game] || [];
        return scores.filter(s => s.location.region === region)
            .sort((a, b) => b.score - a.score);
    }

    getCountryRanking(game, country) {
        const scores = this.scores[game] || [];
        return scores.filter(s => s.location.country === country)
            .sort((a, b) => b.score - a.score);
    }

    getWeeklyReport(userId) {
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const report = {};
        
        Object.keys(this.scores).forEach(game => {
            const userScores = this.scores[game].filter(s => 
                s.userId === userId && s.timestamp >= weekAgo
            );
            report[game] = {
                played: userScores.length,
                bestScore: Math.max(...userScores.map(s => s.score), 0),
                totalScore: userScores.reduce((sum, s) => sum + s.score, 0)
            };
        });
        
        return report;
    }
}

const leaderboard = new LeaderboardManager();

// ═══════════════════════════════════════════════════════════
//  🎮 GAME 1: SUDOKU
// ═══════════════════════════════════════════════════════════

class SudokuGame {
    constructor() {
        this.board = [];
        this.solution = [];
        this.difficulty = 'medium';
    }

    generate(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.board = this.createSolvedBoard();
        this.solution = JSON.parse(JSON.stringify(this.board));
        
        // Remove numbers based on difficulty
        const toRemove = { easy: 30, medium: 40, hard: 50 }[difficulty];
        this.removeNumbers(toRemove);
    }

    createSolvedBoard() {
        const board = Array(9).fill().map(() => Array(9).fill(0));
        this.solveSudoku(board);
        return board;
    }

    solveSudoku(board) {
        const empty = this.findEmpty(board);
        if (!empty) return true;
        
        const [row, col] = empty;
        const numbers = this.shuffle([1,2,3,4,5,6,7,8,9]);
        
        for (let num of numbers) {
            if (this.isValid(board, row, col, num)) {
                board[row][col] = num;
                if (this.solveSudoku(board)) return true;
                board[row][col] = 0;
            }
        }
        return false;
    }

    findEmpty(board) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) return [r, c];
            }
        }
        return null;
    }

    isValid(board, row, col, num) {
        // Check row
        if (board[row].includes(num)) return false;
        
        // Check column
        for (let r = 0; r < 9; r++) {
            if (board[r][col] === num) return false;
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (board[r][c] === num) return false;
            }
        }
        
        return true;
    }

    removeNumbers(count) {
        let removed = 0;
        while (removed < count) {
            const row = Math.floor(Math.random() * 9);
            const col = Math.floor(Math.random() * 9);
            if (this.board[row][col] !== 0) {
                this.board[row][col] = 0;
                removed++;
            }
        }
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    render(container) {
        let html = '<div class="sudoku-grid">';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const value = this.board[r][c];
                const readonly = value !== 0;
                html += `<input type="text" maxlength="1" 
                    class="sudoku-cell ${readonly ? 'readonly' : ''}" 
                    data-row="${r}" data-col="${c}" 
                    value="${value || ''}" 
                    ${readonly ? 'readonly' : ''}
                    onkeypress="return event.charCode >= 49 && event.charCode <= 57">`;
            }
        }
        html += '</div>';
        container.innerHTML = html;
    }

    check() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] !== this.solution[r][c]) return false;
            }
        }
        return true;
    }
}

// Export all game classes and functions
window.GamesSystem = {
    GAMES,
    leaderboard,
    SudokuGame,
    startGame,
    endGame,
    submitScore,
    showLeaderboard,
    generateGameReport
};

// Initialize games
function initGames() {
    checkDailyStreak();
    loadGameStats();
}

function checkDailyStreak() {
    const today = new Date().toDateString();
    if (lastPlayedDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastPlayedDate === yesterday) {
            dailyStreak++;
        } else {
            dailyStreak = 1;
        }
        localStorage.setItem('gamesStreak', dailyStreak);
        localStorage.setItem('lastGameDate', today);
    }
}

function startGame(gameType) {
    currentGame = gameType;
    gameStartTime = Date.now();
    gameScore = 0;
}

function endGame(finalScore) {
    if (!currentGame) return;
    
    const timeTaken = Math.floor((Date.now() - gameStartTime) / 1000);
    gameScore = finalScore;
    
    // Calculate points based on score and time
    const timeBonus = Math.max(0, 1000 - timeTaken);
    const totalPoints = finalScore + timeBonus;
    
    // Save score
    const userId = session
