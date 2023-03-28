import * as vscode from 'vscode';
import { query, conversation, Message } from './model';
const highlightjs = require('markdown-it-highlightjs');
const md = require('markdown-it')();
md.use(highlightjs);

const STATICS = 'statics';
let panel: vscode.WebviewPanel | undefined;

function createWebviewPanel(context: vscode.ExtensionContext) {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
        return;
    }
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

    const htmlString = `<!DOCTYPE html>
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
            <div id="chatContainer">
                <div id="chatBody">
                    <div class="loadingspinner"></div>
                </div>
                <div id="chatInput">
                    <textarea></textarea>
                </div>
            </div>
        </body>
        <script src="${highlightjsUri}"></script>
        <script src="${scriptUri}"></script>
    </html>`.trim();

    panel.webview.html = htmlString;

    if (conversation.length >= 2) {
        updateWebviewPanel(conversation);
    }

    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'query_model':
                    query(message.content);
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    panel.onDidDispose(() => {
        panel = undefined;
    }, null, context.subscriptions);
}

function updateWebviewPanel(content: any) {
    panel?.webview.postMessage(
        {
            command: 'delta_update',
            content: flattenMessages(content)
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

function openPanel(context: vscode.ExtensionContext) {
    panel === undefined ? createWebviewPanel(context) : null;
}

function sendWebviewCommand(command: string) {
    panel?.webview.postMessage({ command: command });
}

export { createWebviewPanel, updateWebviewPanel, openPanel, sendWebviewCommand };
