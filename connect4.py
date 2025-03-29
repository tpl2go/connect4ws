__all__ = ["Player", "Connect4Game"]

import enum

class Player(enum.StrEnum):
    RED = "red"
    YELLOW = "yellow"

class Connect4Game:
    """
    A Connect Four game.

    Play moves with :meth:`play`.

    Get past moves with :attr:`moves`.

    Check for a victory with :attr:`winner`.

    """

    def __init__(self, join_key: str, watch_key: str):
        self.moves = []
        self.top = [0 for _ in range(7)]
        self.winner = None

        self.join_websockets = set()
        self.watch_websockets = set()

        self.join_key = join_key
        self.watch_key = watch_key

    @property
    def last_player(self) -> Player:
        """
        Player who played the last move.

        """
        return Player.RED if len(self.moves) % 2 else Player.YELLOW

    @property
    def last_player_won(self) -> bool:
        """
        Whether the last move is winning.

        """
        b = sum(1 << (8 * column + row) for _, column, row in self.moves[::-2])
        return any(b & b >> v & b >> 2 * v & b >> 3 * v for v in [1, 7, 8, 9])

    def play(self, player: Player, column: int) -> tuple[int,int]:
        """
        Play a move in a column.

        Returns the row where the checker lands.

        Raises :exc:`ValueError` if the move is illegal.

        """
        if player == self.last_player:
            raise ValueError("It isn't your turn.")

        row = self.top[column]
        if row == 6:
            raise ValueError("This slot is full.")

        self.moves.append((player, column, row))
        self.top[column] += 1

        if self.winner is None and self.last_player_won:
            self.winner = self.last_player

        return row, len(self.moves)
