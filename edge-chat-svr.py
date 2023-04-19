import argparse
import asyncio
import json
import traceback
import websockets
import time
from datetime import datetime
from EdgeGPT import Chatbot, ConversationStyle
import pproxy.server
import multiprocessing
import sys
import base64
import re
import urllib.parse
from simpleUserManager import SimpleUserManager
import datetime

TokenExpDeltaTime = datetime.timedelta(days = 7)

UserManager = None

def proxyUrlDecode(url):
    def authoriseReplacement(match):
        secStr = match.group(0)
        return str(base64.b64decode(secStr), "utf-8")
    url = url if isinstance(url, str) else str(url, "utf-8") if isinstance(url, bytes) else str(url)
    descIndex = url.rfind("#")
    desc = url[descIndex+1:] if descIndex > 0 else None
    desc = urllib.parse.unquote(desc)
    url = url[:descIndex] if descIndex > 0 else url
    url = re.sub(r"(?<=\://).*?(?=@)", authoriseReplacement, url)
    return (url, desc)

class ChatbotManager:
    def __init__(self, configFile: str, cookiesFile: str) -> None:
        with open(configFile, 'r', encoding="utf-8") as f:
            self.config = json.load(f)
        with open(cookiesFile, 'r', encoding="utf-8") as f:
            self.cookies = json.load(f)
        waitTickThreshold = self.config["wait.tick.threshold"] if "wait.tick.threshold" in self.config else 0
        self.waitTickThreshold = waitTickThreshold if isinstance(waitTickThreshold, int) else 0
        self.bots = {}
        self.proxyP = None
        self.localProxy = None
        if "token.expire.days" in self.config:
            global TokenExpDeltaTime
            TokenExpDeltaTime = datetime.timedelta(days = self.config["token.expire.days"])
        if "remote.proxy" in self.config:
            proxyStr = self.config["remote.proxy"]
            if not isinstance(proxyStr, str):
                del self.config["remote.proxy"]
            elif len(proxyStr.strip()) == 0:
                del self.config["remote.proxy"]
            else:
                proxyURL, proxyDesc = proxyUrlDecode(self.config["remote.proxy"])
                self.config["remote.proxy"] = proxyURL
                self.config["remote.proxy.desc"] = proxyDesc
                localPort = self.config["local.proxy.port"] if "local.proxy.port" in self.config else None
                localPort = localPort if isinstance(localPort, int) and localPort >= 20000 else 20000
                self.localProxy = f"socks5://127.0.0.1:{localPort}"

    def checkProxy(self):
        if self.proxyP != None:
            if self.proxyP.is_alive():
                return
        if "remote.proxy" in self.config:
            print(f"Use proxy \"{self.config['remote.proxy.desc']}\" => \"{self.config['remote.proxy']}\"")
            self.proxyP = multiprocessing.Process(target=pproxy.server.main, args=(["-l", self.localProxy, "-r", self.config["remote.proxy"]],))
            self.proxyP.start()

    def exit(self):
        try:
            if self.proxyP != None:
                self.terminate()
                self.join()
        finally:
            sys.exit()

    def getBot(self, key) -> Chatbot:
        self.checkProxy()
        key = str(key)
        bot = self.bots.get(key)
        if bot is None:
            bot = Chatbot(cookies=self.cookies, proxy=self.localProxy)
            self.bots[key] = bot
        return bot
    
    async def resetBot(self, key) -> Chatbot:
        key = str(key)
        bot = self.bots.get(key)
        if bot != None:
            await bot.close()
        self.checkProxy()
        bot = Chatbot(cookies=self.cookies, proxy=self.localProxy)
        self.bots[key] = bot
        return bot
    
    async def removeBot(self, key):
        key = str(key)
        bot = self.bots.get(key)
        if bot != None:
            del self.bots[key]
            await bot.close()
    
ChatbotManagerInstance = None

MessageProcessorMap = {}
def msg_proc(name: str):
    def decorator(func):
        MessageProcessorMap[name] = func
        return func
    return decorator

BotStyleMap = {
    "creative": ConversationStyle.creative,
    "balanced": ConversationStyle.balanced,
    "precise": ConversationStyle.precise
}

@msg_proc("ask")
async def procAsk(websocket, msg, sendFn):
    try:
        token = UserManager.checkUserTokenWithUpdate(msg["user"], msg["token"], expDays = TokenExpDeltaTime)
        if not token is None:
            await sendFn(json.dumps({ "type": "updateToken", "user": msg["user"], "token": token, "max-age": int(TokenExpDeltaTime.total_seconds()) }))
        botStyle = msg["style"] if "sytle" in msg else "creative"
        botStyle = BotStyleMap[botStyle] if botStyle in BotStyleMap else ConversationStyle.creative
        bot = ChatbotManagerInstance.getBot(websocket.id)
        timeStamp = 0
        async for response in bot.ask_stream(prompt=msg["text"], conversation_style=botStyle, wss_link=ChatbotManagerInstance.config["wss.link"]):
            if response[0]:
                await sendFn(json.dumps({
                    "type": "response",
                    "action": msg["action"],
                    "for": msg["id"],
                    "response": response[1]
                }))
                print("Answer has been send.")
            else:
                curTime = int(time.time()*1000)
                if (timeStamp == 0) or (curTime - timeStamp >= ChatbotManagerInstance.waitTickThreshold):
                    timeStamp = curTime
                    await sendFn(json.dumps({ 
                        "type": "wait",
                        "action": msg["action"],
                        "for": msg["id"],
                        "response": response[1]
                    }))
    except Exception as e:
        print("!!!EXCEPTION!!!")
        print(e)
        traceback.print_exc()
        await sendFn(json.dumps({ "type": "error" }))

@msg_proc("reset")
async def procReset(websocket, msg, sendFn):
    try:
        await ChatbotManagerInstance.resetBot(websocket.id)
        reply = {
            "type": "response",
            "action": msg["action"],
            "for": msg["id"]
        }
        await sendFn(json.dumps(reply))
    except Exception as e:
        print("!!!EXCEPTION!!!")
        print(e)
        traceback.print_exc()
        await sendFn(json.dumps({ "type": "error" }))

@msg_proc("checkUser")
async def procCheckUser(websocket, msg, sendFn):
    try:
        token = UserManager.checkUserTokenWithUpdate(msg["user"], msg["token"], expDays = TokenExpDeltaTime) if "token" in msg else UserManager.checkUserOtpWithWithUpdateToken(msg["user"], msg["code"], expDays = TokenExpDeltaTime)
        await sendFn(json.dumps({ "type": "updateToken", "user": msg["user"], "token": token, "max-age": int(TokenExpDeltaTime.total_seconds()) }))
    except:
        try:
            errCode = 0
            if UserManager.hasUser(msg["user"]):
                errCode = 1
            elif UserManager.isUserInit(msg["user"]):
                errCode = 2
            await sendFn(json.dumps({ "type": "authorizeFail", "code": errCode }))
        except:
            traceback.print_exc()
            await sendFn(json.dumps({ "type": "error" }))

@msg_proc("initUser")
async def procInitUser(websocket, msg, sendFn):
    try:
        if "code" in msg:
            token = UserManager.initUserFinal(msg["user"], msg["code"], TokenExpDeltaTime)
            if token is None:
                raise RuntimeError("Fail in step 2")
            else:
                await sendFn(json.dumps({ "type": "updateToken", "user": msg["user"], "token": token, "max-age": int(TokenExpDeltaTime.total_seconds()) }))
        else:
            uri = UserManager.initUserStart(msg["user"])
            if uri is None:
                raise RuntimeError("Fail in step 1")
            else:
                await sendFn(json.dumps({ "type": "initUserTOTP", "uri": uri }))
    except:
        traceback.print_exc()
        await sendFn(json.dumps({ "type": "error" }))

async def handler(websocket):
    try:
        async def sendFn(respStr):
            await websocket.send(str(base64.b64encode(bytes(respStr, "utf-8")), "utf-8"))
        async for message in websocket:
            try:
                msg = json.loads(base64.b64decode(message).decode("utf-8", errors="replace").replace("�", " "))
                print(msg)
                func = MessageProcessorMap[msg["action"]]
                if func != None:
                    await func(websocket, msg, sendFn)
            except websockets.ConnectionClosed:
                raise
            except Exception as e:
                print (f"Unhandle exception {e} in socket({websocket.id})")
                try:
                    await websocket.send(str(base64.b64encode(bytes(json.dumps({
                        "type": "error",
                        "error": f"{e}"
                    }), "utf-8")), "utf-8"))
                except:
                    await websocket.close()
    except websockets.ConnectionClosed:
        print (f"Connection closed({websocket.id})")
    finally:
        await websocket.wait_closed()
        print (f"Connection closed gracefully({websocket.id})")
        await ChatbotManagerInstance.removeBot(websocket.id)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        type=str,
        required=True,
        help="Path of the configuration file",
    )
    parser.add_argument(
        "--cookies",
        type=str,
        required=True,
        help="Path of the json file storing the cookies",
    )
    parser.add_argument(
        "--users",
        type=str,
        required=True,
        help="Path of the file storing the users",
    )
    args = parser.parse_args()
    global ChatbotManagerInstance
    global UserManager
    ChatbotManagerInstance = ChatbotManager(args.config, args.cookies)
    ChatbotManagerInstance.checkProxy()
    UserManager = SimpleUserManager(args.users, "Edge Bing Hub")
    print("Starting the websocket service")
    async with websockets.serve(handler, "0.0.0.0", ChatbotManagerInstance.config["port"]):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    multiprocessing.set_start_method('spawn')
    asyncio.run(main())
