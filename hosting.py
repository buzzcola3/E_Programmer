import asyncio
from jsonrpc import JSONRPCResponseManager, dispatcher
from microdot import Microdot, send_file
from microdot.websocket import with_websocket

app = Microdot()


@app.route('/')
async def run(request):
    return send_file("webserver/index.html")

@app.route('webserver/<path:path>')
async def static(request, path):
    if '..' in path:
        # directory traversal is not allowed
        return 'Not found', 404
    return send_file('webserver/' + path)

@app.route('/ws')
@with_websocket  # type: ignore
async def echo(request, ws):
    while True:
        message = await ws.receive()
        await handle_receive(ws, message)

async def handle_receive(ws, message):
    print("handleRX")
    if(message == "ping"):
        await handle_send(ws, "pong")
        return

    asyncio.create_task(handle_execute_and_send(ws, message))

async def handle_execute_and_send(ws, message):
    response = await JSONRPCResponseManager.handle(message, dispatcher)
    await handle_send(ws, response.json)
    pass

async def handle_send(ws, message):
    await websocket_send(ws, message)


async def websocket_send(ws, message):
    result = False
    try:
        await ws.send(message)
        result = True
        print(f"Message sent successfully")
    except websockets.ConnectionClosed as e:
        print(f"WebSocket connection closed: Code={e.code}, Reason={e.reason}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    return result

app.run(debug=True, port=80)