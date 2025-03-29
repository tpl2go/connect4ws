import { createBoard, playMove } from "./connect4.js";

let websocket;

function showElement(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideElement(id) {
    document.getElementById(id).classList.add('hidden');
}
function getWebSocketServer() {
    if (window.location.host === "tplio.click") {
        return "wss://tplio.click/connect4ws/ws";
    } else if (window.location.host === "127.0.0.1:3000") {
        return "ws://localhost:8001/";
    } else if (window.location.host === "localhost:3000") {
        return "ws://localhost:8001/";
    } else {
        throw new Error(`Unsupported host: ${window.location.host}`);
    }
}

function initWSConnection(websocket, mode, key, playerName) {
    websocket.addEventListener("open", () => {
        const event = {
            type: "init",
            mode: mode,
            key: key,
            playerName: playerName
        };
        websocket.send(JSON.stringify(event));
    });
}

function showMessage(message) {
    window.alert(message);
}

function receiveMoves(board, websocket) {
    websocket.addEventListener("message", ({ data }) => {
        const event = JSON.parse(data);
        switch (event.type) {
            case "init":
                document.getElementById('game-join-link').textContent = `${window.location.origin}?join=${event.join}`;
                document.getElementById('game-watch-link').textContent = `${window.location.origin}?join=${event.watch}`;
                document.getElementById('game-status').textContent = `waiting for opponent...`;
                showElement('game-info');
                break;
            case "play":
                playMove(board, event.player, event.column, event.row);
                break;
            case "win":
                showMessage(`Player ${event.player} wins!`);
                websocket.close(1000);
                break;
            case "error":
                showMessage(event.message);
                break;
            case "opponent_joined":
                showMessage(`${event.opponentName} has joined the game!`);
                showElement('game-board');
                break;
            default:
                throw new Error(`Unsupported event type: ${event.type}.`);
        }
    });
}

function sendMoves(board, websocket) {
    // Existing sendMoves function...
}

function createNewGame(playerName) {
    websocket = new WebSocket(getWebSocketServer());
    initWSConnection(websocket, "new", "", playerName);
    const board = document.querySelector(".board");
    showElement('game-board');
    createBoard(board);
    receiveMoves(board, websocket);
    sendMoves(board, websocket);
}

function joinExistingGame(gameCode, playerName) {
    websocket = new WebSocket(getWebSocketServer());
    initWSConnection(websocket, "join", gameCode, playerName);
    const board = document.querySelector(".board");
    createBoard(board);
    receiveMoves(board, websocket);
    sendMoves(board, websocket);
    showElement('game-board');
}

window.addEventListener("DOMContentLoaded", () => {
    const createGameBtn = document.getElementById('create-game');
    const joinGameBtn = document.getElementById('join-game');
    const createSubmitBtn = document.getElementById('create-submit');
    const joinSubmitBtn = document.getElementById('join-submit');

    createGameBtn.addEventListener('click', () => {
        hideElement('landing-page');
        showElement('create-game-form');
    });

    joinGameBtn.addEventListener('click', () => {
        hideElement('landing-page');
        showElement('join-game-form');
    });

    createSubmitBtn.addEventListener('click', () => {
        const playerName = document.getElementById('create-name').value;
        if (playerName) {
            hideElement('create-game-form');
            createNewGame(playerName);
        } else {
            showMessage('Please enter your name.');
        }
    });

    joinSubmitBtn.addEventListener('click', () => {
        const gameCode = document.getElementById('join-code').value;
        const playerName = document.getElementById('join-name').value;
        if (gameCode && playerName) {
            hideElement('join-game-form');
            joinExistingGame(gameCode, playerName);
        } else {
            showMessage('Please enter both game code and your name.');
        }
    });

    // Check if there's a join parameter in the URL
    const params = new URLSearchParams(window.location.search);
    if (params.has("join")) {
        hideElement('landing-page');
        showElement('join-game-form');
        document.getElementById('join-code').value = params.get("join");
    }
});