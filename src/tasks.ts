import * as vscode from 'vscode';
import * as model from './model';

const supportedLanguages = ['c', 'cpp', 'java', 'javascript', 'python', 'typescript', 'typescriptreact'];

interface TasksDictionary {
    [key: string]: {
      role: string;
      content: string;
      title?: string;
    };
  }

const tasks: TasksDictionary = {
    'default': {
        title: 'General Conversation',
        role: "system",
        content: "Please strictly follow user instructions and their provided facts."
    },
    'codeOptimiation': {
        title: 'Optimize this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to optimize the provided code snippet."
    },
    'codeReview': {
        title: 'Review this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to review the code snippet provided to you and offer suggestions."
    },
    'codeCommenting': {
        title: 'Comment this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to comment the code snippet provided to you. Please be concise."
    },
    'codeCompletion': {
        title: 'Complete this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to complete the code snippet provided to you."
    },
    'codeGeneration': {
        title: 'Generate code',
        role: "system",
        content: "You are a senior software engineer. Your task is to generate code based on the description provided to you."
    },
    'codeExplanation': {
        title: 'Explain this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to explain the code snippet provided to you."
    },
    'codeDebugging': {
        title: 'Debug this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to debug the code snippet provided to you."
    },
    'codeDocumentation': {
        title: 'Document this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to write documentation for the code snippet provided to you."
    },
    'codeRefactoring': {
        title: 'Refactor this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to refactor the code snippet provided to you."
    },
    'codeTesting': {
        title: 'Write test for this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to write tests for the code snippet provided to you."
    },
    'codeTranslation': {
        title: 'Translate this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to translate the code snippet provided to you. The user will tell you the desired language. Please wait for user input before translating."
    },
    'codeCustomAction': {
        title: 'AMA about this code',
        role: "system",
        content: "You are a senior software engineer. Your task is to answer any questions about the code snippet provided to you. The user will ask you questions."
    },
};

function registerTasks(context: vscode.ExtensionContext) {
    for (const task in tasks) {
        let disposable = vscode.languages.registerCodeActionsProvider(
            supportedLanguages,
            {

                // Provide code actions for the given document and range.
                provideCodeActions(document, range) {

                    // Create a code action.
                    const action = new vscode.CodeAction(tasks[task].title!, vscode.CodeActionKind.QuickFix);

                    // Set the command that is executed when the code action is selected.
                    action.command = {
                        title: tasks[task].title!,
                        command: `chatsensei.${task}`
                    };

                    // Set the diagnostics that this code action resolves.
                    action.diagnostics = [];

                    // Return the code action.
                    return [action];
                }
            }
        );
        context.subscriptions.push(disposable);

        // Register a command that is invoked when the code action is selected
        disposable = vscode.commands.registerCommand(`chatsensei.${task}`, () => {
            performCodeAction(task);
        });
        context.subscriptions.push(disposable);
    }
}

function performCodeAction(task: string) {
    getCodeSnippet()
    .then((result) => {
        const languageId = result[0];
        const text = result[1];
        const fileName = result[2];
        if (text.length === 0) {
            vscode.window.showInformationMessage('No code selected or current file is not supported.');
            return;
        }
        model.codeAction(task, `${tasks[task].title!}:\n${codeBlock(languageId, text)}`);
    });
}

// Get the selected text or the current function definition
async function getCodeSnippet():Promise<[string, string, string]> {
    const editor = vscode.window.activeTextEditor;
    if (editor && supportedLanguages.includes(editor.document.languageId)) {
        const languageId = editor.document.languageId;
        let selection = editor.selection;
        let text = editor.document.getText(selection);
        const fileName = editor.document.fileName.split('/').pop() || '';

        // If text is selected, return it
        if (text.length > 0) {
            return [languageId, beautify(text), fileName];
          }

        // If no text is selected, get current function definition
        if (text.length === 0) {
            const line = editor.document.lineAt(selection.start.line);
            let textLine = line.text;
            const outline = vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                editor.document.uri
            );

            if (outline) {
                await outline.then((symbols: any) => {
                    for (let i = 0; i < symbols.length; i++) {
                        if (symbols[i].kind === vscode.SymbolKind.Function && textLine.includes(symbols[i].name)) {
                            text = editor.document.getText(symbols[i].range);
                            editor.selection = new vscode.Selection(symbols[i].range.start, symbols[i].range.end);
                            break;
                        }
                    }
                });

                // remove all spaces on the right
                return [languageId, beautify(text), fileName];
            }
        }
    }

    // If no text is selected and no function definition is found, return empty string
    return ['', '', ''];
}

function codeBlock(languageId: string, text: string) {
    return '```' + languageId + '\n' + text + '\n```\n';
}

function beautify(text: string): string {
    let lines = text.split('\n');
    let minIndentation = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.trim().length > 0) {
            let indentation = line.search(/\S/);
            if (indentation >= 0 && indentation < minIndentation) {
                minIndentation = indentation;
            }
        }
    }
    let trimmedLines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.trim().length > 0) {
            trimmedLines.push(line.substring(minIndentation));
        } else {
            trimmedLines.push('');
        }
    }
    return trimmedLines.join('\n').replace(/\s+$/g, '');
}

export { tasks, registerTasks };
