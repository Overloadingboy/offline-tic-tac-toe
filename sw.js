/**
 * CYBERTIC EVOLUTION - CORE ENGINE
 * Includes: AI Logic, Peer-to-Peer Multiplayer, and PWA Registration
 */

// --- 1. GLOBAL STATE & INITIALIZATION ---
let board = Array(9).fill("");
let curLvl = parseInt(localStorage.getItem('cur_lvl')) || 1;
let active = true;
let gameMode = 'ai'; // 'ai' or 'pvp'
let peer = null;
let conn = null;
let myRole = "X"; // Default for AI mode and Multiplayer Host

const cells = document.querySelectorAll('.cell');
const select = document.getElementById('levelSelect');
const statusDisplay = document.getElementById('status');

// Setup Level Dropdown Categories
const categories = ['EASY (1-30)', 'NORMAL (31-60)', 'DIFFICULT (61-89)', 'IMPOSSIBLE (90-100)'];
categories.forEach(label => {
    let group = document.createElement('optgroup');
    group.label = label;
    select.appendChild(group);
});

// Populate 100 Levels
for (let i = 1; i <= 100; i++) {
    let opt = document.createElement('option');
    opt.value = i; opt.text = `Level ${i}`;
    let gIndex = i <= 30 ? 0 : i <= 60 ? 1 : i <= 89 ? 2 : 3;
    select.querySelectorAll('optgroup')[gIndex].appendChild(opt);
}

// --- 2. MULTIPLAYER (PEERJS) LOGIC ---
function initMultiplayer() {
    peer = new Peer(); 
    peer.on('open', (id) => { 
        document.getElementById('my-id').innerText = id; 
    });

    // Listen for someone connecting to you (You are the Host/X)
    peer.on('connection', (connection) => {
        conn = connection;
        myRole = "X";
        setupPeerListeners();
        statusDisplay.innerText = "Friend Joined! Your Turn (X)";
    });
}

function connectToPeer() {
    const peerId = document.getElementById('peer-id-input').value;
    if (!peerId) return alert("Please enter a Friend's ID");
    
    conn = peer.connect(peerId);
    myRole = "O"; // You are the Joiner/O
    setupPeerListeners();
    statusDisplay.innerText = "Connecting to Host...";
}

function setupPeerListeners() {
    conn.on('open', () => {
        statusDisplay.innerText = myRole === "X" ? "Your Turn (X)" : "Wait for Host (X)";
    });
    conn.on('data', (data) => {
        if (data.type === 'move') handleRemoteMove(data.index);
    });
}

function handleRemoteMove(i) {
    let opponentRole = myRole === "X" ? "O" : "X";
    executeMove(i, opponentRole);
}

// --- 3. CORE GAMEPLAY ENGINE ---
function setMode(mode) {
    gameMode = mode;
    document.getElementById('btnAI').classList.toggle('active', mode === 'ai');
    document.getElementById('btnPVP').classList.toggle('active', mode === 'pvp');
    document.getElementById('pvp-controls').style.display = mode === 'pvp' ? 'block' : 'none';
    
    if (mode === 'pvp' && !peer) initMultiplayer();
    resetBoard();
}

function play(i) {
    if (board[i] !== "" || !active) return;

    if (gameMode === 'pvp') {
        // Logic to determine whose turn it is (X always starts)
        let currentTurn = board.filter(x => x !== "").length % 2 === 0 ? "X" : "O";
        if (currentTurn !== myRole) return; 
        
        if (conn && conn.open) {
            conn.send({ type: 'move', index: i });
        } else {
            return alert("Not connected to a friend!");
        }
    }

    executeMove(i, myRole === "X" ? (board.filter(x => x !== "").length % 2 === 0 ? "X" : "O") : (board.filter(x => x !== "").length % 2 === 0 ? "X" : "O"));
    // Simplification: In AI mode, myRole is always X. In PVP, executeMove uses the correct turn symbol.

    if (gameMode === 'ai' && active) {
        active = false;
        statusDisplay.innerText = "AI is thinking...";
        setTimeout(cpuPlay, 600);
    }
}

function executeMove(i, role) {
    board[i] = role;
    cells[i].innerText = role;
    cells[i].classList.add(role.toLowerCase());
    
    if (!checkWin(role)) {
        active = true;
        statusDisplay.innerText = (gameMode === 'pvp') ? "Waiting for opponent..." : "Your Turn";
    }
}

// --- 4. AI (MINIMAX) LOGIC ---
function cpuPlay() {
    let move;
    if (curLvl >= 90) {
        move = getBestMoveMinimax();
    } else {
        let avail = board.map((v, i) => v === "" ? i : null).filter(v => v !== null);
        // Difficulty scaling: Probability of making the "perfect" move
        move = (Math.random() < curLvl/90) ? (findWin("O") || findWin("X") || avail[0]) : avail[Math.floor(Math.random()*avail.length)];
    }
    
    if (move !== undefined) {
        board[move] = "O";
        cells[move].innerText = "O";
        cells[move].classList.add("o");
        if (!checkWin("O")) {
            active = true;
            statusDisplay.innerText = "Your Turn";
        }
    }
}

function getBestMoveMinimax() {
    let bestScore = -Infinity; let move;
    for (let i = 0; i < 9; i++) {
        if (board[i] === "") {
            board[i] = "O";
            let score = minimax(board, 0, false);
            board[i] = "";
            if (score > bestScore) { bestScore = score; move = i; }
        }
    }
    return move;
}

function minimax(b, d, isMax) {
    if (checkTWin("O")) return 10 - d;
    if (checkTWin("X")) return d - 10;
    if (!b.includes("")) return 0;

    if (isMax) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === "") {
                b[i] = "O";
                bestScore = Math.max(minimax(b, d + 1, false), bestScore);
                b[i] = "";
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === "") {
                b[i] = "X";
                bestScore = Math.min(minimax(b, d + 1, true), bestScore);
                b[i] = "";
            }
        }
        return bestScore;
    }
}

// Helper: Check terminal win for Minimax
function checkTWin(p) {
    const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return w.some(a => a.every(i => board[i] === p));
}

// Helper: Find instant win/block for Normal Difficulty
function findWin(p) {
    for (let i = 0; i < 9; i++) {
        if (board[i] === "") {
            board[i] = p;
            if (checkTWin(p)) { board[i] = ""; return i; }
            board[i] = "";
        }
    }
    return null;
}

function checkWin(p) {
    if (checkTWin(p)) {
        statusDisplay.innerText = p === "X" ? "SYSTEM BREACHED: YOU WIN!" : "AI SUPREMACY: YOU LOSE.";
        active = false;
        if (p === "X" && curLvl < 100) {
            curLvl++;
            localStorage.setItem('cur_lvl', curLvl);
        }
        setTimeout(() => { resetBoard(); updateUI(); }, 2000);
        return true;
    }
    if (!board.includes("")) {
        statusDisplay.innerText = "STALEMATE DETECTED.";
        active = false;
        setTimeout(() => { resetBoard(); updateUI(); }, 2000);
        return true;
    }
    return false;
}

// --- 5. UI UTILITIES ---
function resetBoard() {
    board = Array(9).fill("");
    active = true;
    cells.forEach(c => { c.innerText = ""; c.className = "cell"; });
    statusDisplay.innerText = gameMode === 'pvp' ? (myRole === "X" ? "Your Turn (X)" : "Wait for Host (X)") : "Ready Player One";
}

function updateUI() {
    select.value = curLvl;
    const badge = document.getElementById('diffBadge');
    if (curLvl <= 30) { badge.innerText = "EASY"; badge.style.color = "var(--easy)"; }
    else if (curLvl <= 60) { badge.innerText = "NORMAL"; badge.style.color = "var(--normal)"; }
    else if (curLvl <= 89) { badge.innerText = "DIFFICULT"; badge.style.color = "var(--difficult)"; }
    else { badge.innerText = "IMPOSSIBLE"; badge.style.color = "var(--impossible)"; }
}

function changeLevel(v) { curLvl = parseInt(v); resetBoard(); updateUI(); }

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function shareProgress() {
    const text = `I've reached Level ${curLvl} in CyberTic! Can you beat the unbeatable AI?`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=https://overloadingboy.github.io/`);
}

// --- 6. SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Offline System Ready'))
            .catch(err => console.log('Offline System Failed', err));
    });
}

// Initialize on load
updateUI();
