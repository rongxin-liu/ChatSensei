import * as vscode from 'vscode';
import * as model from './model';

const commands: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
    console.log("chatSensei is now active!");

    init(context);

    commands.push(
        vscode.commands.registerCommand('chatsensei.openPanel', () => {
            model.openPanel();
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.ask', () => {
        const placeHolder = "Send a message to ChatSensei...";
        vscode.window.showInputBox({ placeHolder: placeHolder })
        .then((input) => {
            input !== undefined ? model.ask(input) : null;
        });
    }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.requestKey', () => {
            model.requestKey();
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.unsetKey', () => {
            model.unsetKey();
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.checkUsage', () => {
            vscode.env.openExternal(vscode.Uri.parse("https://platform.openai.com/account/usage"));
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.resetConversation', () => {
            model.resetConversation();
        }));

    subscribeAll(context, commands);
}

function init(context: vscode.ExtensionContext) {
    model.init(context);
}

function subscribeAll(context: vscode.ExtensionContext, disposables: vscode.Disposable[]) {
    for (const disposable of disposables) {
        context.subscriptions.push(disposable);
    }
}

export function deactivate() {}
