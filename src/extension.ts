import * as vscode from 'vscode';
import * as model from './model';
import * as tasks from './tasks';
import * as panel from './panel';

const commands: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {

    init(context);

    commands.push(
        vscode.commands.registerCommand('chatsensei.openPanel', () => {
            panel.openPanel(context);
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.enterImmersiveMode', async () => {
            vscode.window.terminals.forEach((terminal) => { terminal.dispose(); });
            await vscode.commands.executeCommand('workbench.action.focusSideBar');
            await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            panel.openPanel(context);
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.exitImmersiveMode', async () => {
            await vscode.commands.executeCommand('workbench.action.focusSideBar');
            await vscode.commands.executeCommand('workbench.action.terminal.new');
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.setModel', async () => {
            await vscode.window.showQuickPick(
                [
                    'gpt-3.5-turbo',
                    'gpt-4',
                    'gpt-4-32k',
                    'text-davinci-002',
                    'text-davinci-003'
                ], {
                placeHolder: 'Select a model',
                ignoreFocusOut: true,
            }).then((value) => {
                if (value !== undefined) {
                    model.setModel(value, true);
                }
            });
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.setRole', async () => {
            await vscode.window.showInputBox({
                prompt: 'Please define the ',
                placeHolder: 'You are a ..., your task is to ...',
                ignoreFocusOut: true,
            }).then((value) => {
                if (value !== undefined && value.trim().length > 0) {
                    model.setRole({ role: 'system', content: String(value) });
                    panel.openPanel(context);
                }
            });
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.query', () => {
        const placeHolder = "Send a message to ChatSensei...";
        vscode.window.showInputBox({ placeHolder: placeHolder })
        .then((input) => {
            input !== undefined ? model.query(input) : null;
        });
    }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.requestKey', () => {
            model.requestKey();
        }));

    commands.push(
        vscode.commands.registerCommand('chatsensei.unsetKey', () => {
            model.unsetKey(true);
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
    tasks.registerTasks(context);
}

function subscribeAll(context: vscode.ExtensionContext, disposables: vscode.Disposable[]) {
    for (const disposable of disposables) {
        context.subscriptions.push(disposable);
    }
}

export function deactivate() {}
