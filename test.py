import asyncio
from websockets.sync.client import connect
import base64
import json

def test():
    with connect("ws://localhost:7171") as websocket:
        def send(msg):
            websocket.send(str(base64.b64encode(bytes(json.dumps(msg), "utf-8")), "utf-8"))
        def recv():
            return json.loads(base64.b64decode(websocket.recv()).decode("utf-8", errors="replace").replace("�", " "))
        # 开始测试
        print(">>> checkUser", 1)
        send({ "action": "checkUser", "user": "test", "token": None })
        print(recv())
        print(">>> checkUser", 2)
        send({ "action": "checkUser", "user": "l", "token": None })
        print(recv())
        print(">>> checkUser", 3)
        send({ "action": "checkUser", "user": None, "token": "123" })
        print(recv())
        print(">>> checkUser", 4)
        token = input("token: ")
        send({ "action": "checkUser", "user": "test", "token": token })
        print(recv())
        print(">>> initUser", 5)
        send({ "action": "initUser", "user": "test", "code": "" })
        print(recv())
        print(">>> initUser", 6)
        send({ "action": "initUser", "user": None })
        print(recv())
        print(">>> initUser", 7)
        send({ "action": "initUser", "user": "test" })
        print(recv())
        print(">>> initUser", 8)
        code = input("OTP Code: ").strip()
        send({ "action": "initUser", "user": "test", "code": code })
        print(recv())

if __name__ == "__main__":
    test()