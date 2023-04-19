import * as React from "react";
import styles from "./authorization.module.css";
import { prepareGetWebsocketFunction } from "../../websocketClient";
import qrcode from "qrcode";

export function getCachedAuthorization() {
    let ret = {};
    document.cookie.split(";").forEach(e => {
        let {0:key,1:value} = e.split("=");
        ret[key.trim()] = (value||"").trim();
    });
    return ret;
}

export function cachedAuthorization(_user, _token, _maxAge) {
    document.cookie = `user=${_user||""};max-age=31536000;path=/;`;
    document.cookie = `token=${_token||""};max-age=${Number(_maxAge) || 604800};path=/;`;
}

export class Authorization extends React.Component {
    constructor (_props) {
        super(_props);
        this.getSocket = prepareGetWebsocketFunction();
        let {user, token} = getCachedAuthorization();
        this.state = {
            ready: false,
            initMode: false,
            user
        };
        (async () => {
            let socket = await this.getSocket();
            try {
                socket.sendEx(JSON.stringify({
                    action: "checkUser",
                    user,
                    token
                }));
                let resp = JSON.parse(await socket.getRespAsync());
                if ((resp.type === "updateToken") && resp.user) {
                    resp.token && cachedAuthorization(resp.user, resp.token, resp["max-age"])
                    this.setState({
                        initMode: false,
                        user: resp.user,
                        error: ""
                    });
                    (typeof this.props.onSignIn === "function") && this.props.onSignIn();
                } else {
                    this.setState({ ready: true });    
                }
            } catch {
                this.setState({ ready: true });
            } finally {
                socket.close();
            }
        })();
    }

    async onStartRegistration() {
        let socket = await this.getSocket();
        try {
            socket.sendEx(JSON.stringify({
                action: "initUser",
                user: this.refs.userInput.value
            }));
            let resp = JSON.parse(await socket.getRespAsync());
            if ((resp.type === "initUserTOTP") && resp.uri) {
                this.setState({
                    initMode: true,
                    qrcode: await qrcode.toDataURL(resp.uri)
                });
            } else {
                this.setState({
                    initMode: false,
                    qrcode: ""
                });
            }
        } finally {
            socket.close();
        }
    }

    async onSignIn() {
        let socket = await this.getSocket();
        try {
            socket.sendEx(JSON.stringify({
                action: this.state.initMode ? "initUser" : "checkUser",
                user: this.refs.userInput.value,
                code: this.refs.codeInput.value,
            }));
            this.refs.codeInput.value = "";
            let resp = JSON.parse(await socket.getRespAsync());
            if ((resp.type === "updateToken") && resp.user) {
                resp.token && cachedAuthorization(resp.user, resp.token, resp["max-age"])
                this.setState({
                    initMode: false,
                    user: resp.user,
                    error: ""
                });
                (typeof this.props.onSignIn === "function") && this.props.onSignIn();
            } else {
                this.setState({error: "Bad user name or OTP code!"});
            }
        } finally {
            socket.close();
        }
    }

    render() {
        return (
            <div className={styles.authBackground}>
                {this.state.ready ? (
                    <div className={styles.authPanel}>
                        <div className={styles.authItemTitle}>Who are U</div>
                        <input ref="userInput" defaultValue={this.state.user} onKeyDown={(e) => String(e.key).toLocaleLowerCase() === "enter" && this.refs.codeInput.focus()}></input>
                        {this.state.initMode ? (<>
                            <div className={styles.authItemTitle}>Scan the QRCode for creating the OTP authenticator</div>
                            <img className={styles.authQRCode} src={this.state.qrcode} />
                        </>) : null}
                        <div className={styles.authItemTitle}>OTP Code</div>
                        <input ref="codeInput" onKeyDown={(e) => String(e.key).toLocaleLowerCase() === "enter" && this.onSignIn()}></input>
                        {this.state.error ? (<div className={styles.authError}>{this.state.error}</div>) : null}
                        <div className={styles.authButton} onClick={() => this.onSignIn()}>Sign In</div>
                        <div className={styles.authRegistration} onClick={() => this.onStartRegistration()}>Registration</div>
                    </div>) : (
                    <div className="waiting-circle" style={{"--size":"9em"}}>
                        Loading...
                    </div>
                )}
            </div>
        )
    }
}
