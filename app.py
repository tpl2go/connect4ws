import asyncio
import http
import json
import os
import secrets
import signal
from websockets.asyncio.server import broadcast, serve
from connect4 import Player, Connect4Game
from pydantic import BaseModel


class RxMessage(BaseModel):
    type: str 
    mode: str | None = None
    key: str | None = None
    playerName: str | None = None
    player: str | None = None
    column: int | None = None
    row: int | None = None

class TxMessage(BaseModel):
    type: str 
    payload : dict | None = None

class TxPlayMessage(TxMessage):
    type: str = "play"
    player: str
    column: int
    row: int
    moveID: int
    playerName: str | None = None

class TxCreateGameMessage(TxMessage):
    type: str = "init"
    watch: str
    join: str

class TxErrorMessage(TxMessage):
    type: str = "error"
    message : str

class TxStatusMessage(TxMessage):
    type: str = "status"
    message : str

class TxWinMessage(TxMessage):
    type: str = "win"
    player : str


JOIN: dict[str, Connect4Game] = {}

WATCH: dict[str, Connect4Game] = {}

async def send_status(websocket, message):
    """
    Send an status message.

    """
    print(f"Sending status: {message}")
    event = TxStatusMessage(message=message)
    await websocket.send(event.model_dump_json())


async def send_error(websocket, message):
    """
    Send an error message.

    """
    event = TxErrorMessage(message=message)
    await websocket.send(event.model_dump_json())


async def send_past_moves(websocket, game: Connect4Game):
    """
    Send previous moves.

    """
    # Make a copy to avoid an exception if game.moves changes while iteration
    # is in progress. If a move is played while replay is running, moves will
    # be sent out of order but each move will be sent once and eventually the
    # UI will be consistent.
    for moveID, (player, column, row) in enumerate(game.moves.copy()):
        event = TxPlayMessage(moveID=moveID, player=player, column=column, row=row)
        await websocket.send(event.model_dump_json())


async def play(websocket, game: Connect4Game, player: Player):
    """
    Receive and process moves from a player.

    """
    async for message in websocket:

        # Limit the length of the message to 100 characters
        # to prevent memory exhaustion attacks
        if len(message) > 100:
            return 
        # Parse a "play" event from the UI.
        print(game, player, message)


        event = json.loads(message)
        event = RxMessage(**event)
        assert event.type == "play"

        try:
            # Play the move.
            row, moveID = game.play(player, event.column)
        except ValueError as exc:
            # Send an "error" event if the move was illegal.
            await send_error(websocket, str(exc))
            continue

        # Send a "play" event to update the UI.
        event = TxPlayMessage(moveID=moveID, player=player, column=event.column, row=row)
        event = event.model_dump_json()
        broadcast(game.join_websockets, event)
        broadcast(game.watch_websockets, event)

        # If move is winning, send a "win" event.
        if game.winner:
            event = TxWinMessage(player=game.winner)
            event = event.model_dump_json()
            broadcast(game.join_websockets, event)
            broadcast(game.watch_websockets, event)
            return


async def start(websocket):
    """
    Handle a connection from the first player: start a new game.

    """
    # Initialize a Connect Four game, the set of WebSocket connections
    # receiving moves from this game, and secret access tokens.
    join_key = secrets.token_urlsafe(12)
    watch_key = secrets.token_urlsafe(12)

    game = Connect4Game(join_key, watch_key)
    game.join_websockets.add(websocket)
    
    JOIN[join_key] = game
    WATCH[watch_key] = game
    print(f"start_game  join_key:{join_key}  watch_key:{watch_key}")

    try:
        # Send the secret access tokens to the browser of the first player,
        # where they'll be used for building "join" and "watch" links.
        event = TxCreateGameMessage(type="init", join=join_key, watch=watch_key)
        await websocket.send(event.model_dump_json())
        
        # Perpetually receive and process moves from the first player
        # until websocket closes
        await play(websocket, game, Player.RED)
    finally:
        print(f"removing game  join_key:{join_key}  watch_key:{watch_key}  websocket:{websocket}")
        del JOIN[join_key]
        del WATCH[watch_key]


async def join(websocket, join_key:str):
    """
    Handle a connection from the second player: join an existing game.

    """
    print(f"join game  join_key:{join_key}")

    # Find the Connect Four game.
    try:
        game = JOIN[join_key]
    except KeyError:
        await send_error(websocket, "Game not found.")
        return

    if len(game.join_websockets) > 1:
        await send_error(websocket, "Two people are already playing.")
        return
    
    await send_status(list(game.join_websockets)[0], "Opponent Connected to game.")

    # Register to receive moves from this game.
    game.join_websockets.add(websocket)
    try:
        # Send the first move, in case the first player already played it.
        await send_past_moves(websocket, game)
        # Perpetually receive and process moves from the second player
        # until websocket closes
        await play(websocket, game, Player.YELLOW)
    finally:
        print(f"removing player 2 websocket from game :{websocket}")
        game.join_websockets.remove(websocket)


async def watch(websocket, watch_key):
    """
    Handle a connection from a spectator: watch an existing game.
    """

    print(f"watch game  watch_key : {watch_key}")

    # Find the Connect Four game.
    try:
        game = WATCH[watch_key]
    except KeyError:
        await send_error(websocket, "Game not found.")
        return

    # Register websockets to receive moves from this game.
    game.watch_websockets.add(websocket)
    try:
        await send_past_moves(websocket, game)
        await websocket.wait_closed()
    finally:
        print(f"removing watch websocket from game :{websocket}")
        game.watch_websockets.remove(websocket)


async def handler(websocket):
    """
    Handle a connection and dispatch it according to who is connecting.

    """
    # Receive and parse the "init" event from the UI.
    message = await websocket.recv()

    # Limit the length of the message to 100 characters for security reasons.
    if len(message) > 100:
        return 
    
    event = json.loads(message)
    event = RxMessage(**event)
    assert event.type== "init"
    assert event.mode in ["join", "watch", "new"]

    match event.mode:
        case "new":
            # First player starts a new game.
            await start(websocket)
        case "join":
            # Second player joins an existing game.
            await join(websocket, event.key)
        case "watch":
            # Spectator watches an existing game.
            await watch(websocket, event.key)
        case _:
            raise ValueError("Invalid mode.")


def health_check(connection, request):
    if request.path == "/healthz":
        return connection.respond(http.HTTPStatus.OK, "OK\n")


async def main():
    port = int(os.environ.get("PORT", "8001"))
    async with serve(handler, "", port, process_request=health_check) as server:
        loop = asyncio.get_running_loop()
        loop.add_signal_handler(signal.SIGTERM, server.close)
        await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())