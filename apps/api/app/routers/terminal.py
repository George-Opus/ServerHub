import asyncio
import json
import logging

import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError

from app.auth.security import decode_access_token
from app.database import SessionLocal
from app.models import Server, User
from app.services.crypto import CredentialDecryptError
from app.services.server_credentials import get_server_auth
from app.services.ssh import open_ssh_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["terminal"])


def _format_error(exc: BaseException) -> str:
    message = str(exc).strip()
    if message:
        return message
    return f"{type(exc).__name__} (sans détail)"


def _parse_resize_message(text: str) -> tuple[int, int] | None:
    if not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if data.get("type") != "resize":
        return None
    cols = int(data.get("cols", 0))
    rows = int(data.get("rows", 0))
    if cols < 2 or rows < 2:
        return None
    return cols, rows


@router.websocket("/api/terminal/{server_id}")
async def terminal_ws(websocket: WebSocket, server_id: int):
    await websocket.accept()

    token = websocket.query_params.get("token")
    username = decode_access_token(token) if token else None

    if not username:
        await websocket.send_text(
            "\r\n\x1b[31mSession invalide ou expirée.\x1b[0m\r\n"
            "\x1b[90mDéconnectez-vous puis reconnectez-vous, puis réouvrez le terminal.\x1b[0m\r\n"
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    conn: asyncssh.SSHClientConnection | None = None
    process: asyncssh.SSHClientProcess | None = None
    term_cols, term_rows = 120, 32

    try:
        server = (
            db.query(Server)
            .join(User, Server.owner_id == User.id)
            .filter(Server.id == server_id, User.username == username)
            .first()
        )
        if not server:
            await websocket.send_text("\r\n\x1b[31mServeur introuvable ou accès refusé.\x1b[0m\r\n")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        auth = get_server_auth(server)
        conn = await open_ssh_connection(
            server.ip_address,
            port=server.ssh_port,
            auth=auth,
        )
        process = await conn.create_process(
            term_type="xterm-256color",
            term_size=(term_rows, term_cols),
            encoding="utf-8",
        )

        async def ssh_to_ws() -> None:
            assert process is not None
            try:
                while True:
                    data = await process.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_text(data)
            except (WebSocketDisconnect, asyncio.CancelledError):
                pass
            except Exception as exc:
                logger.exception("terminal ssh_to_ws error")
                await websocket.send_text(f"\r\n\x1b[31mErreur lecture SSH : {_format_error(exc)}\x1b[0m\r\n")

        async def ws_to_ssh() -> None:
            nonlocal term_cols, term_rows
            assert process is not None
            try:
                while True:
                    message = await websocket.receive()
                    if message["type"] == "websocket.disconnect":
                        break
                    text = message.get("text")
                    if text:
                        resize = _parse_resize_message(text)
                        if resize:
                            cols, rows = resize
                            if cols != term_cols or rows != term_rows:
                                term_cols, term_rows = cols, rows
                                process.change_terminal_size(cols, rows)
                            continue
                        process.stdin.write(text)
                        await process.stdin.drain()
                    else:
                        raw = message.get("bytes")
                        if raw:
                            process.stdin.write(raw.decode("utf-8", errors="replace"))
                            await process.stdin.drain()
            except (WebSocketDisconnect, asyncio.CancelledError):
                pass

        tasks = [
            asyncio.create_task(ssh_to_ws()),
            asyncio.create_task(ws_to_ssh()),
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        await asyncio.gather(*done, return_exceptions=True)

    except WebSocketDisconnect:
        pass
    except CredentialDecryptError as exc:
        await websocket.send_text(f"\r\n\x1b[31m{_format_error(exc)}\x1b[0m\r\n")
    except JWTError:
        await websocket.send_text("\r\n\x1b[31mToken JWT invalide.\x1b[0m\r\n")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except (asyncssh.Error, ConnectionError, OSError) as exc:
        await websocket.send_text(f"\r\n\x1b[31mErreur SSH : {_format_error(exc)}\x1b[0m\r\n")
    except Exception as exc:
        logger.exception("terminal unexpected error")
        await websocket.send_text(f"\r\n\x1b[31mErreur : {_format_error(exc)}\x1b[0m\r\n")
    finally:
        if process:
            process.close()
        if conn:
            conn.close()
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
