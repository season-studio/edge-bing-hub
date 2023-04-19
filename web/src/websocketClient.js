import { Base64 } from "js-base64";

export function prepareGetWebsocketFunction(_msgCallback, _closeCallback) {
    const WebSocketCloseManually = "wsmc-" + Date.now();
    let instance = null;
    let fn = function () {
        if (instance instanceof WebSocket) {
            return Promise.resolve(instance);
        } else if (instance instanceof Promise) {
            return instance;
        } else {
            return fetch("assets/link-info.json")
                    .then(r => r.json())
                    .then(linkInfo => {
                        instance = new Promise(r => {
                            let newSocket = new WebSocket(linkInfo.url);
                            newSocket.$respLogs = {};
                            newSocket.sendEx = function (data) { newSocket.send(Base64.encode(String(data))); };
                            newSocket.getRespAsync = function (fn) {
                                return new Promise(r => {
                                    if (typeof fn !== "function") {
                                        newSocket.addEventListener("message", (e) => r(Base64.decode(e.data||"")), {once:true});
                                    } else {
                                        let handler = (e) => {
                                            let eData = fn(Base64.decode(e.data||""), e);
                                            if (eData !== undefined) {
                                                r(eData);
                                                newSocket.removeEventListener("message", handler);
                                            }
                                        };
                                        newSocket.addEventListener("message", handler);
                                    }
                                });
                            };
                            newSocket.addEventListener("open", () => {
                                instance = newSocket;
                                r(newSocket);
                            });
                            newSocket.addEventListener("message", (e) => ((typeof _msgCallback === "function") && _msgCallback(Base64.decode(e.data||""), e)));
                            newSocket.addEventListener("close", (e) => {
                                instance = null;
                                e.$isManualClose = (e.reason === WebSocketCloseManually);
                                (typeof _closeCallback === "function") && _closeCallback(e);
                            });
                        });
                        return instance;
                    });
        }
    };
    function closePromise(r) {
        try {
            if (instance instanceof WebSocket) {
                if (instance.readyState > 1) {
                    r();
                } else {
                    instance.addEventListener("close", () => r(), { once: true });
                    instance.close(1000, WebSocketCloseManually);
                }
            }
        } catch {
            r();
        }
    }
    fn.close = function () {
        if (instance instanceof WebSocket) {
            return new Promise(closePromise);
        } else if (instance instanceof Promise) {
            return instance.then(() => new Promise(closePromise));
        }
    }
    Object.freeze(fn);
    return fn;
}
