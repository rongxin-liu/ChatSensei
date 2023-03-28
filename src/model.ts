/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { tasks } from './tasks';
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
    title?: string;
}

let conversation: Message[] = [tasks.default];

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
        value ? vscode.window.showInformationMessage('API key set successfully') : null;
    });
}

function setKey(key: string) {
    try {
        key = key.trim();
        if (key.length === 0) {
            throw new Error('API key is empty');
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

function unsetKey() {
    openai = new OpenAIApi(new Configuration());
    _context.globalState.update('chatsensei.apiKey', undefined);
    didSetApiKey = false;
    vscode.window.showInformationMessage('OpenAI API key has been unset');
}

function codeAction(task: string, text: string) {
    query(text, task);
}

async function query(content: string, task: string = 'default') {

    !didSetApiKey ? await requestKey() : null;
    panel === undefined ? createWebviewPanel(_context) : null;
    setRole(tasks[task]);

    conversation.push({ role: "user", content: content });
    updateWebviewPanel(flattenMessages(conversation));

    console.log(conversation);
    try {
        const response = await openai.createChatCompletion(
            {
                model: "gpt-3.5-turbo",
                messages: conversation,
                stream: true
            }, { responseType: 'stream' });


        conversation.push({ role: "assistant", content: '' });
        let buffer: string = '';
        response.data.on('data', (data: { toString: () => string; }) => {

            // Split stream data into lines and filter out empty lines
            const lines = data.toString().split('\n').filter((line: string) => line.trim() !== '');

            // Process each line of stream data
            for (const line of lines) {

                // Strip 'data: ' prefix from line
                const message = line.replace(/^data: /, '');

                // Stream finished, perform final delta update
                if (message === '[DONE]') {
                    conversation[conversation.length - 1].content = buffer;
                    updateWebviewPanel(flattenMessages(conversation));
                    sendWebviewCommand('update_finished');
                    return;
                }

                // Parse JSON message, extract content and update buffer
                try {
                    const content = JSON.parse(message).choices[0].delta.content;
                    content !== undefined ? buffer += content : null;
                    conversation[conversation.length - 1].content = buffer;
                } catch (error) {
                    console.error('Could not JSON parse stream message', message, error);
                }
            }
            updateWebviewPanel(flattenMessages(conversation));
        });
    }
    catch (error: any) {
        console.log(error.response.data);
    }
}

function setRole(role: Message) {

    // create a hard copy of the role object
    role = JSON.parse(JSON.stringify(role));
    delete role.title;
    conversation[0] = role;
    panel ? updateWebviewPanel(flattenMessages(conversation)) : null;
}

function openPanel() {
    panel === undefined ? createWebviewPanel(_context) : null;
    updateWebviewPanel(flattenMessages(conversation));
}

function resetConversation() {
    conversation = [tasks.default];
    panel ? updateWebviewPanel(flattenMessages(conversation)) : null;
}

function sendWebviewCommand(command: string) {
    panel?.webview.postMessage({ command: command });
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

// Base64 decoding
function decode(str: any) {
    return String(Buffer.from(String(str), 'base64').toString('binary'));
}

// Base64 encoding
function encode(str: any) {
    return String(Buffer.from(String(str), 'binary').toString('base64'));
}

export { init, openPanel, requestKey, unsetKey, query, codeAction, resetConversation };
