import * as React from "react";
import * as ReactDOM from "react-dom";
import { ManualPanel } from "./components/manualPanel";
import * as MarkdownIt from "markdown-it";
import { Base64 } from "js-base64";
import "./index.css";

function resize(_view) {
    let body = document.querySelector("body");
    if (body) {
        body.style.position = (_view.clientHeight < window.innerHeight) ? "absolute" : "relative";
    }
}

const H5TextNormalizeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\n": "<br />"
};

function normalizeH5Text(_text) {
    return String(_text||"").replace(/[\&\<\>\n\s]/g, (e) => {
        return H5TextNormalizeMap[e] || "&nbsp;"
    })
}

function prepareGetWebsocketFunction(_msgCallback, _closeCallback) {
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
                            newSocket.addEventListener("open", () => {
                                instance = newSocket;
                                r(newSocket);
                            });
                            newSocket.addEventListener("message", (e) => ((typeof _msgCallback === "function") && _msgCallback(e)));
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

class MainView extends React.Component {

    constructor(_props) {
        super(_props);

        this.markdown = new MarkdownIt();
        this.getSocket = prepareGetWebsocketFunction(
            (e) => this.onResponse(JSON.parse(Base64.decode(e.data))), 
            (e) => ((e.$isManualClose) || this.appendChatItem("error", "服务器连接已关闭，请重试"))
        );
        window.onresize = () => this.adjustChatView();
        // for DEBUG
        window.$md = this.markdown;
    }

    appendChatItem(_type, _text, _fn) {
        let div = document.createElement("div");
        if (div) {
            div.setAttribute("class", `chat-item chat-${_type}`);
            div.insertAdjacentHTML("beforeend", `<div class="chat-content ${_type}-content">${((typeof _fn === "function") ? _fn : normalizeH5Text)(_text)}</div>`);
            this.refs.chatView.insertAdjacentElement("beforeend", div);
            div.$content = div.querySelector(".chat-content");
            div.$updateContent = (contentHtml) => {
                div.$content && (div.$content.innerHTML = contentHtml);
                this.adjustChatView();
            };
            this.adjustChatView();
        }
        return div;
    }

    adjustChatView() {
        setImmediate(() => {
            resize(this.refs.chatView);
            this.refs.chatView.scrollIntoView(false);
        });
    }

    async getResponseItem(_id, _force, _socket) {
        let argsCount = arguments.length;
        if (argsCount > 1) {
            let lastArg = arguments[argsCount - 1];
            if (lastArg instanceof WebSocket) {
                if (argsCount < 3) {
                    _socket = lastArg;
                    _force = true;
                }
            }
            (_socket instanceof WebSocket) || (_socket = undefined);
        } else {
            _force = true;
        }
        let socket = _socket || await this.getSocket();
        if (socket) {
            let item = socket.$respLogs && socket.$respLogs[_id];
            if (!item && _force) {
                let respLogs = (socket.$respLogs || (socket.$respLogs = {}));
                item = (respLogs[_id] = this.appendChatItem("response"));
            }
            return item;
        }
    }

    async request(_msg) {
        try {
            let socket = await this.getSocket();
            if (!socket) {
                throw "无法创建通讯连接";
            }
            _msg.id = `${Date.now()}-${Math.random()}`;
            socket.send(Base64.encode(JSON.stringify(_msg)));
            if (_msg.action === "ask") {
                let respItem = await this.getResponseItem(_msg.id, socket);
                if (respItem) {
                    respItem.$content.innerHTML = "发送成功，等待应答……";
                }
            }
        } catch (err) {
            this.appendChatItem("error", err);
        }
    }

    onResponse(_resp) {
        try {
            let fn = this[`${_resp.type}Proc`];
            (typeof fn === "function") && fn.call(this, _resp);
        } catch (err) {
            this.appendChatItem("error", "无法处理的应答\n" + String(err));
        }
    }

    async responseProc(_resp) {
        if (_resp.action === "ask") {
            let respItem = await this.getResponseItem(_resp.for, false);
            if (respItem) {
                let response = _resp.response.item.messages.find(e => e.author === "bot");
                respItem.$botResponse = response;
                console.log(response);

                let content;
                
                let adaptiveCards = Array.from(response.adaptiveCards||[]).filter(e => e);
                let refList = Array.from(response.sourceAttributions||[]).filter(e => e);
                if (adaptiveCards.length > 0) {
                    // 按适配卡的形式来格式化最终结果
                    let hasRefFoot = false;
                    content = adaptiveCards.map(card => {
                        let textBodyCount = 0;
                        return Array.from(card.body||[]).map(body => {
                            if (body.type !== "TextBlock") {
                                return "";
                            } else {
                                textBodyCount++;
                                let bodyHtml = this.markdown.render(body.text);
                                if (textBodyCount > 1) {
                                    hasRefFoot = true;
                                    bodyHtml = `<div class="chat-ref-block">${bodyHtml}</div>`;
                                }
                                return bodyHtml; 
                            }
                        }).join("");
                    }).join("");
                    if (!hasRefFoot && (refList.length > 0)) {
                        content += "<hr /><b class=\"chat-ref-foot\">参考资料：</b>" + refList.map((e, idx) => `<a class="chat-ref-foot" href="${e.seeMoreUrl}">${idx+1}.&nbsp;${normalizeH5Text(e.providerDisplayName)}</a>`).join("");
                    }
                } else {
                    // 自己从text中格式化结果
                    if (refList.length > 0) {
                        content = this.markdown.render(response.text).replace(/\[\^(\d+)\^\]/ig, (_, num) => {
                            let refItem = refList[num];
                            return refItem ? `<a class="chat-ref" href="${refItem.seeMoreUrl}">${num}</a>` : "";
                        });
                        content += "<hr /><b class=\"chat-ref-foot\">参考资料：</b>" + refList.map((e, idx) => `<a class="chat-ref-foot" href="${e.seeMoreUrl}">${idx+1}.&nbsp;${normalizeH5Text(e.providerDisplayName)}</a>`).join("");
                    } else {
                        content = this.markdown.render(response.text).replace(/\[\^(\d+)\^\]/ig,  "");
                    }
                }
                respItem.$updateContent(content);
                Array.from(respItem.querySelectorAll("a")).forEach(e => {
                    if (e instanceof Element) {
                        e.textContent = String(e.textContent||"").replace(/\^(\d+)\^/ig, (_, num) => num);
                        e.setAttribute("target", "_blank");
                        e.classList.add("chat-ref");
                    }
                });

                let suggestList = Array.from(response.suggestedResponses||[]).filter(e => e);
                if (suggestList.length > 0) {
                    let suggestView = this.appendChatItem("suggest");
                    if (suggestView) {
                        suggestView.$updateContent("<b>您可能想问：</b>" + suggestList.map(e => `<span class="suggest-item">${normalizeH5Text(e.text)}</span>`).join(""));
                    }
                }
                
                this.adjustChatView();
            }
        }
    }

    async waitProc(_resp) {
        if (_resp.action === "ask") {
            let respItem = await this.getResponseItem(_resp.for, false);
            if (respItem && respItem.$content) {
                let content = _resp.response;
                content = "<p><b>正在生成应答……</b></p>" + (content ? this.markdown.render(content).replace(/\<a .*?\<\/a\>/ig, "") : "");
                respItem.$updateContent(content);
                this.adjustChatView();
            }
        }
    }

    errorProc(_resp) {
        let error = (_resp.error || "");
        if (error) {
            this.appendChatItem("error", null, () => `远程服务器出现错误，请重试<p style="font-size: 0.7em;">${error}</p>`);
        } else {
            this.appendChatItem("error", "远程服务器出现错误，请重试");
        }
    }

    onAction(_msg) {
        const fn = this[_msg.action + "Action"];
        (typeof fn === "function") && fn.call(this, _msg);
        this.adjustChatView();
    }

    askAction(_msg) {
        this.refs.chatView.querySelector(".chat-suggest")?.remove();
        this.appendChatItem("ask", _msg.text);
        this.request(_msg);
    }

    resetAction(_msg) {
        this.refs.chatView.innerHTML = "";
        this.getSocket.close();
    }

    onExport() {
        let text = [...this.refs.chatView.children].map(e => {
            if (e && e.classList) {
                if (e.classList.contains("chat-ask")) {
                    return "# 提问：" + (e.textContent || "");
                } else if (e.$botResponse) {
                    return [...(e.$botResponse.adaptiveCards||[])].map(item => {
                        return [...(item?.body||[])].map(body => body?.text || "").join("\n\n");
                    }).join("\n\n");
                }
            }
            return null;
        }).filter(e => e).join("\n\n");
        let textBlob = new Blob([text], {type: "text/plain"});
        let a = document.createElement("a"); 
        a.href = URL.createObjectURL(textBlob); 
        a.download = "chat-log.md"; 
        a.click();
        URL.revokeObjectURL(a.href);
    }

    onviewClick(_e) {
        if (_e.target?.classList?.contains("suggest-item")) {
            let text = (_e.target?.textContent || "");
            if (text) {
                let msg = {
                    action: "ask",
                    text
                };
                this.askAction(msg);
            }
        }
    }

    render() {
        return (
        <>
            <div ref="chatView" className="chat-view" onClick={(e) => this.onviewClick(e)}>
            </div>
            <ManualPanel onAction={(e) => this.onAction(e)} onExport={() => this.onExport()} />
        </>);
    }
}

window.addEventListener("load", (e) => {
    ReactDOM.render(
        <MainView />,
        document.querySelector("body")
      );
});