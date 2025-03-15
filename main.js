import { createBoard, playMove } from "./connect4.js";

function getWebSocketServer() {
    if (window.location.host === "tplio.click") {
        return "wss://tplio.click/connect4ws/ws";
    } else if (window.location.host === "127.0.0.1:3000") {
        return "ws://localhost:8001/";
    } else {
        throw new Error(`Unsupported host: ${window.location.host}`);
    }
}

function initWSConnection(websocket, mode, key) {
    websocket.addEventListener("open", () => {
        // Send an "init" event to server to identify the client
        let event = { type: "init" };
        // assert that mode can only be "join", "watch", or "new".
        event.mode = mode;
        event.key = key;
        websocket.send(JSON.stringify(event));
    });
}

function showMessage(message) {
    window.setTimeout(() => window.alert(message), 50);
}

function receiveMoves(board, websocket) {
    websocket.addEventListener("message", ({ data }) => {
        const event = JSON.parse(data);
        switch (event.type) {
            case "init":
                // Create links for inviting the second player and spectators.
                const newDiv = document.createElement("div");
                // print event.join and event.watch links as inner HTML in newDiv element
                newDiv.innerHTML = `${window.location}?join=${event.join}`;
                document.querySelector(".actions").append(newDiv);
                document.querySelector(".start-game").remove()
                break;

            case "play":
                // Update the UI with the move.
                playMove(board, event.player, event.column, event.row);
                break;
            case "win":
                showMessage(`Player ${event.player} wins!`);
                // No further messages are expected; close the WebSocket connection.
                websocket.close(1000);
                break;
            case "error":
                showMessage(event.message);
                break;
            default:
                throw new Error(`Unsupported event type: ${event.type}.`);
        }
    });
}

function sendMoves(board, websocket) {
    // Don't send moves for a spectator watching a game.
    const params = new URLSearchParams(window.location.search);
    if (params.has("watch")) {
        return;
    }

    // When clicking a column, send a "play" event for a move in that column.
    board.addEventListener("click", ({ target }) => {
        const column = target.dataset.column;
        // Ignore clicks outside a column.
        if (column === undefined) {
            return;
        }
        const event = {
            type: "play",
            column: parseInt(column, 10),
        };
        websocket.send(JSON.stringify(event));
    });
}

window.addEventListener("DOMContentLoaded", () => {
    // Initialize the UI.
    const board = document.querySelector(".board");
    createBoard(board);
    const params = new URLSearchParams(window.location.search);
    if (params.has("join")) {
        console.log("Joining game:", params.get("join"));
        const websocket = new WebSocket(getWebSocketServer());
        initWSConnection(websocket, "join", params.get("join"));
        document.querySelector(".start-game").disabled = true;
        receiveMoves(board, websocket);
        sendMoves(board, websocket);
    } else if (params.has("watch")) {
        const websocket = new WebSocket(getWebSocketServer());
        initWSConnection(websocket, "watch", params.get("watch"));
        document.querySelector(".start-game").disabled = true;
        receiveMoves(board, websocket);
        sendMoves(board, websocket);
    }
    else {
        document.querySelector(".start-game").addEventListener("click", createWS);
    }
});

function createWS() {
    // Open the WebSocket connection and register event handlers.
    const websocket = new WebSocket(getWebSocketServer());
    initWSConnection(websocket, "new", "");
    const board = document.querySelector(".board");
    receiveMoves(board, websocket);
    sendMoves(board, websocket);
}