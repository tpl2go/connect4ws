import { createBoard, playMove, sendMoves } from "./connect4.js";

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
        console.log(event);
        switch (event.type) {
            case "init":
                document.getElementById('game-join-link').textContent = `${window.location.origin}?join=${event.join}`;
                document.getElementById('game-watch-link').textContent = `${window.location.origin}?watch=${event.watch}`;
                addStatusMessage("Game Created");
                addStatusMessage("Waiting for opponent...`);");
                showElement('game-info');
                showElement('status-panel');
                break;
            case "play":
                playMove(board, event.player, event.column, event.row);
                addStatusMessage(`${event.player} played in column ${event.column + 1} row ${event.row + 1}.`);
                break;
            case "win":
                showMessage(`Player ${event.player} wins!`);
                websocket.close(1000);
                break;
            case "error":
                showMessage(event.message);
                break;
            case "status":
                console.log(`${event.message}`);
                addStatusMessage(`${event.message}`);

                break;
            default:
                throw new Error(`Unsupported event type: ${event.type}.`);
        }
    });
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

    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const textToCopy = document.getElementById(targetId).textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    });
});

function addStatusMessage(message) {
    const statusMessages = document.getElementById('status-messages');
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    statusMessages.appendChild(messageElement);
    statusMessages.scrollTop = statusMessages.scrollHeight; // Scroll to bottom
}

