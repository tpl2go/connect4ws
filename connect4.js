const PLAYER1 = "red";

const PLAYER2 = "yellow";

/**
 * Creates the game board for Connect Four.
 * 
 * This function generates the HTML structure for the Connect Four game board,
 * including columns and cells. It also injects the necessary stylesheet.
 *
 * @param {HTMLElement} board - The container element where the game board will be created.
 * @returns {void} This function does not return a value.
 */
function createBoard(board) {
  // Inject stylesheet.
  const linkElement = document.createElement("link");
  linkElement.href = import.meta.url.replace(".js", "_board.css");
  linkElement.rel = "stylesheet";
  document.head.append(linkElement);
  // Generate board.
  for (let column = 0; column < 7; column++) {
    const columnElement = document.createElement("div");
    columnElement.className = "column";
    columnElement.dataset.column = column;
    for (let row = 0; row < 6; row++) {
      const cellElement = document.createElement("div");
      cellElement.className = "cell empty";
      cellElement.dataset.column = column;
      columnElement.append(cellElement);
    }
    board.append(columnElement);
  }
}

function playMove(board, player, column, row) {
  // Check values of arguments.
  if (player !== PLAYER1 && player !== PLAYER2) {
    throw new Error(`player must be ${PLAYER1} or ${PLAYER2}.`);
  }
  const columnElement = board.querySelectorAll(".column")[column];
  if (columnElement === undefined) {
    throw new RangeError("column must be between 0 and 6.");
  }
  const cellElement = columnElement.querySelectorAll(".cell")[row];
  if (cellElement === undefined) {
    throw new RangeError("row must be between 0 and 5.");
  }
  // Place checker in cell.
  if (!cellElement.classList.replace("empty", player)) {
    throw new Error("cell must be empty.");
  }
}

function sendMoves(board, websocket) {

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
    console.log(`sending event: ${JSON.stringify(event)}`);
    websocket.send(JSON.stringify(event));
  });
}

export { PLAYER1, PLAYER2, createBoard, playMove, sendMoves };
