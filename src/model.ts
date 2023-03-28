/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
const { Configuration, OpenAIApi } = require("openai");
const highlightjs = require('markdown-it-highlightjs');
const md = require('markdown-it')();
md.use(highlightjs);

const STATICS = 'statics';

let openai: any;
let configuration: any;
let _context: vscode.ExtensionContext;
let didSetApiKey: boolean = false;

let panel: vscode.WebviewPanel | undefined;

interface Message {
    role: string;
    content: string;
    name?: string;
  }

const systemMessage: Message = { role: "system", content: "You are a helpful assistant." };
const conversation: Message[] = [systemMessage];

async function init(context: vscode.ExtensionContext) {
    _context = context;
    const key = context.globalState.get('chatsensei.apiKey');
    key !== undefined ? setKey(decode(key)) : null;
}

async function requestKey() {
    await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key. https://platform.openai.com/account/api-keys',
        placeHolder: 'sk-',
        ignoreFocusOut: true,
    }).then((value) => {
        setKey(value || '');
    });
}

function setKey(key: string) {
    try {
        key = key.trim();
        if (key.length === 0) {
            throw new Error('API key is empty.');
        }
        configuration = new Configuration({ apiKey: key });
        openai = new OpenAIApi(configuration);
        _context.globalState.update('chatsensei.apiKey', encode(key));
        didSetApiKey = true;
    } catch (e) {
        console.log(e);
        vscode.window.showErrorMessage(`Failed to set API key: ${e}`);
        return false;
    }
    return true;
}

function removeKey() {
    openai = new OpenAIApi(new Configuration());
    _context.globalState.update('chatsensei.apiKey', undefined);
    didSetApiKey = false;
}

async function ask(content: string) {
    !didSetApiKey ? await requestKey() : null;
    panel === undefined ? createWebviewPanel(_context) : null;

    conversation.push({ role: "user", content: content });
    updateWebviewPanel(flattenMessages(conversation));

    openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: conversation
    }).then((response: any) => {

        conversation.push({ role: "assistant", content: response.data.choices[0].message.content });
        updateWebviewPanel(flattenMessages(conversation));

    }).catch((error: any) => {
        console.log(error.response.data);
        error.response.data.code === 'invalid_api_key' ? removeKey() : null;
        vscode.window.showErrorMessage(`Error occurred: ${error}`);
    });
}

// update each content field with parsed markdown
function flattenMessages(messages: Message[]) {
    const tmp: Message[] = [];
    messages.map((message) => {
        tmp.push({
            role: message.role,
            content: md.render(message.content),
        });
        return message;
    });
    return tmp;
}

function createWebviewPanel(context: vscode.ExtensionContext) {
    panel = vscode.window.createWebviewPanel(
        'chatsensei',
        `ChatSensei`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    let styleUri;
    let highlightStyleUri;
    let lightTheme = [vscode.ColorThemeKind.Light, vscode.ColorThemeKind.HighContrastLight];
    const isLightTheme = lightTheme.includes(vscode.window.activeColorTheme.kind);
    if (isLightTheme) {
        styleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/css/light.css`
        ));
        highlightStyleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/vendor/highlightjs/11.7.0/styles/github.min.css`));
    } else {
        styleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/css/dark.css`
        ));
        highlightStyleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/vendor/highlightjs/11.7.0/styles/github-dark.min.css`));
    }

    const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/js/index.js`));

    const highlightjsUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extension.extensionUri, `${STATICS}/vendor/highlightjs/11.7.0/highlight.min.js`));

    const htmlString =
    `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <link href="${highlightStyleUri}" rel="stylesheet">
            <link href="${styleUri}" rel="stylesheet">
            <style>
                .loadingspinner {
                    pointer-events: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 2.5em;
                    height: 2.5em;
                    margin-left: -1.25em;
                    margin-height -1.25em;
                    border: 0.4em solid transparent;
                    border-color: var(--vscode-editor-background);;
                    border-top-color: var(--vscode-editor-foreground);;
                    border-radius: 50%;
                    animation: loadingspin 1s linear infinite;
                }
                @keyframes loadingspin {
                    100% {
                            transform: rotate(360deg)
                    }
                }
            </style>
        </head>
        <body>
            <div id="delta">
                <div class="loadingspinner"></div>
            </div>
        </body>
        <script src="${highlightjsUri}"></script>
        <script src="${scriptUri}"></script>
    </html>`.trim();
    panel.webview.html = htmlString;

    panel.onDidDispose(() => {
        panel = undefined;
    }, null, context.subscriptions);
}

function updateWebviewPanel(content: any) {
    panel?.webview.postMessage(
        {
            command: 'delta_update',
            content: content
        });
}

// Base64 decoding
function decode (str: any) {
    return String(Buffer.from(String(str), 'base64').toString('binary'));
}

// Base64 encoding
function encode (str: any) {
    return String(Buffer.from(String(str), 'binary').toString('base64'));
}

export { init, setKey, ask };
