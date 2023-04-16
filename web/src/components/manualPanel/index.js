import * as React from "react";
import styles from "./manualPanel.module.css";

export class ManualPanel extends React.Component {

    constructor (_props) {
        super(_props);
        this.state = {
            wordCount: 0
        }
    }

    onAsk(_input) {
        let fn = this.props.onAction;
        let text = _input.value || "";
        (typeof fn === "function") && (text) && fn({
            action: "ask",
            text
        });
        _input.value = "";
        this.setState({
            wordCount: 0
        });
    }

    onWordChange(_e) {
        this.setState({
            wordCount: _e.target.textLength
        });
    }

    onWordKeyDown(_e) {
        if ((String(_e.key).toLocaleLowerCase() === "enter") && _e.ctrlKey) {
            this.onAsk(_e.target);
            _e.preventDefault();
        }
    }

    onReset() {
        let fn = this.props.onAction;
        (typeof fn === "function") && fn({
            action: "reset"
        });
    }
    
    render() {
        return (
        <div className={styles.mainPanel}>
            <div className={`${styles.button} ${styles.resetButton}`} onMouseDown={(e) => (e.button === 0) && this.onReset()}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M20.7024 2.07782C20.3937 1.9095 20.0071 2.02326 19.8387 2.33191L14.7415 11.679C14.1315 11.2867 12.5639 10.42 11.3923 11.0061C10.3929 11.5061 10.1645 11.9182 9.7972 12.5811L9.75982 12.6485L17.4519 16.3461C17.8157 15.5976 18.0392 14.7269 17.7579 13.977C17.4612 13.1858 16.5737 12.5962 15.8846 12.2419L20.9565 2.94145C21.1248 2.6328 21.011 2.24614 20.7024 2.07782ZM9.05827 13.7646L9.08017 13.7343L16.7805 17.4359C16.6758 17.5743 16.5752 17.6958 16.4848 17.7962L12.9912 21.8721C12.7862 22.1113 12.4811 22.2405 12.1701 22.1901C11.4069 22.0663 9.9278 21.7116 8.93156 20.7456C8.80688 20.6246 8.85936 20.4169 9.00607 20.324C9.86774 19.7781 10.625 18.4374 10.625 18.4374C10.625 18.4374 9.05827 19.4999 7.0625 19.4374C5.52782 19.3893 3.64397 17.9429 2.85543 17.2771C2.6979 17.144 2.76842 16.8923 2.96968 16.8476C4.24898 16.5636 7.68904 15.6473 9.05827 13.7646Z"></path>
                    <path d="M8.60974 9.02978C8.52129 8.8234 8.22871 8.82341 8.14026 9.02978L7.77833 9.87431C7.70052 10.0559 7.55586 10.2005 7.37431 10.2783L6.52978 10.6403C6.3234 10.7287 6.32341 11.0213 6.52978 11.1097L7.37431 11.4717C7.55586 11.5495 7.70052 11.6941 7.77833 11.8757L8.14026 12.7202C8.22871 12.9266 8.52129 12.9266 8.60974 12.7202L8.97167 11.8757C9.04948 11.6941 9.19414 11.5495 9.37569 11.4717L10.2202 11.1097C10.4266 11.0213 10.4266 10.7287 10.2202 10.6403L9.37569 10.2783C9.19414 10.2005 9.04948 10.0559 8.97167 9.87431L8.60974 9.02978Z"></path>
                    <path d="M14.0511 5.99109C13.9847 5.8363 13.7653 5.8363 13.6989 5.99109L13.4275 6.62448C13.3691 6.76064 13.2606 6.86914 13.1245 6.92749L12.4911 7.19895C12.3363 7.26528 12.3363 7.48472 12.4911 7.55105L13.1245 7.82251C13.2606 7.88086 13.3691 7.98936 13.4275 8.12552L13.6989 8.75891C13.7653 8.9137 13.9847 8.9137 14.0511 8.75891L14.3225 8.12552C14.3809 7.98936 14.4894 7.88086 14.6255 7.82251L15.2589 7.55105C15.4137 7.48472 15.4137 7.26528 15.2589 7.19895L14.6255 6.92749C14.4894 6.86914 14.3809 6.76064 14.3225 6.62448L14.0511 5.99109Z"></path>
                </svg>
                <div>新话题</div>
            </div>
            <div className={styles.inputArea}>
                <textarea ref="wordInput" className={styles.inputBox} 
                    type="text" autoFocus maxLength="2000" 
                    autoCapitalize="off" autoComplete="off" aria-autocomplete="both" spellCheck="false" autoCorrect="off" 
                    placeholder={`请输入问题，按Ctrl+回车发送 (构建号${PackStamp})`} 
                    rows="1" enterKeyHint="enter"
                    onChange={(e) => this.onWordChange(e)}
                    onKeyDown={(e) => this.onWordKeyDown(e)}></textarea>
                <div className={styles.toolBar}>
                    <div className={styles.wordCountLabel}>{this.state.wordCount}/2000</div>
                    <div className={styles.button} onClick={() => (typeof this.props.onExport === "function") && this.props.onExport()}>
                        <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
                            <path style={{strokeWidth: '2px'}} d="M 14.53,0 0,14.53 V 89.11 C 0,92.9 3.1,96 6.89,96 H 89.11 C 92.9,96 96,92.9 96,89.11 V 6.89 C 96,3.1 92.9,0 89.11,0 Z m 1.17,2.82 h 5.48 v 32.47 c 0,2.34 1.88,4.24 4.24,4.24 h 45.16 c 2.36,0 4.24,-1.9 4.24,-4.24 V 2.82 h 14.29 c 2.25,0 4.09,1.82 4.09,4.07 v 82.22 c 0,2.25 -1.84,4.09 -4.09,4.09 H 6.89 C 4.64,93.2 2.82,91.36 2.82,89.11 V 15.7 Z m 8.3,0 h 48 v 32.47 c 0,0.78 -0.64,1.42 -1.42,1.42 H 25.42 C 24.64,36.71 24,36.07 24,35.29 Z m 7.06,4.24 V 32.47 H 42.35 V 7.06 Z m 2.83,2.83 h 5.64 V 29.65 H 33.89 Z M 48,48 c -8.58,0 -15.53,6.95 -15.53,15.53 0,8.58 6.95,15.53 15.53,15.53 8.58,0 15.53,-6.95 15.53,-15.53 C 63.53,54.96 56.57,48.01 48,48 Z m 0,2.82 c 7.02,0 12.71,5.69 12.71,12.71 0,7.02 -5.69,12.69 -12.71,12.71 -7.02,0 -12.71,-5.69 -12.71,-12.71 0,-7.02 5.69,-12.71 12.71,-12.71 z" />
                            <rect x="43.5" y="60" width="8.5" height="8.5"/>
                        </svg>
                        <div>导出会话</div>
                    </div>
                    <div className={`${styles.button} ${styles.sendButton}`} onClick={() => this.onAsk(this.refs.wordInput)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
                            <path d="M64 1920q-28 0-46-18t-18-47q0-7 2-17l189-658q5-17 19-30t32-16l878-139q14-2 22-11t8-24q0-14-8-23t-22-12L242 786q-18-3-32-16t-19-30L2 82Q0 72 0 65q0-28 18-46T64 0q15 0 27 6l1920 896q17 8 27 23t10 35q0 19-10 34t-27 24L91 1914q-12 6-27 6z"></path>
                        </svg>
                        <div>发送</div>
                    </div>
                </div>
            </div>
        </div>);
    }
}
