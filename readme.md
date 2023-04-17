# Edge Bing Hub
This project provides a web service and a web page as it's front-end for accessing the bing's chat.
This project takes the [EdgeGPT](https://github.com/acheong08/EdgeGPT/) as the core lib for accessing the bing's API.

# How to use

### 1. Check if you have a Microsoft account with accessing to <https://bing.com/chat>

- Install the Dev Edition of the Microsoft Edge
- Open [bing.com/chat](https://bing.com/chat)
- If you see a chat feature, you are good to go

### 2. Getting authentication

- Install the cookie editor extension for [Edge](https://microsoftedge.microsoft.com/addons/detail/neaplmfkghagebokkhpjpoebhdledlfi)
- Go to `bing.com`
- Open the extension
- Click "Export" on the bottom right, then "Export as JSON" (This saves your cookies to clipboard)
- Paste your cookies into a file `cookies.json`

### 3. Setup the environment for the web service

- Install the python 3.8+
- Install the modules listed in the requirements.txt
- Write the ``config.json`` taking the ``config.sample.json`` as the example. The ``port`` value means the port that the service will listen. The ``remote.proxy`` value means the proxy for accessing the internet in China.

### 4. Start the web service

```sh
$ cd <the path of the project>
$ python3 ./edge-chat-svr.py --config <the file of config.json> --cookies <the file of cookies.json>
```

### 5. Setup the environment for the front-end

- Write the ``web/assets/link-info.json`` taking the ``link-info.sample.json`` as the example. The ``url`` value means the websocket address of the service. For example, if the ``port`` in config.json is 7171, and the service is running in the local machine, the ``url`` may be set as ``wss://localhost:7171/``.

### 6. Build and Start the front-end

```sh
$ cd <the path of the project>/web
$ npm i
$ npm run build
$ npm run dev-server
```

## Discuss

- I have only tested the shadowsocks as the proxy.
- You can deploy this project on the server. The target files of the front-end are inside ``./web/dist`` after you run ``npm run build``. Be sure the value of ``url`` in the ``link-info.json`` is the correct address of the server running the web service. **But please note whether this behavior conforms to local laws.**
- You can use EdgeGPT in console mode directly. Please visit the [EdgeGPT's home page ](https://github.com/acheong08/EdgeGPT/) for the usage.
