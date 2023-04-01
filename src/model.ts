/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { createWebviewPanel, sendWebviewCommand, updateWebviewPanel, updateWebviewTitle } from './panel';
import { tasks } from './tasks';
const { Configuration, OpenAIApi } = require("openai");

export interface Message {
    role: string;
    content: string;
    title?: string;
}

const TIMEOUT = 10000; // ms

let openai: any;
let _context: vscode.ExtensionContext;
let didSetApiKey: boolean = false;
let processing: boolean = false;
let currentRole = tasks['default'];
export let currentModel = 'gpt-3.5-turbo';
export let conversation: Message[] = [tasks.default];

async function init(context: vscode.ExtensionContext) {
    _context = context;
    const key = context.globalState.get('chatsensei.apiKey');
    if (key !== undefined) {
        setKey(decode(key)) ? activateOpenAI(String(decode(key))) : null;
    }
    const model = context.globalState.get('chatsensei.model');
    if (model !== undefined) {
        setModel(String(model));
    }
}

async function requestKey() {
    await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key. https://platform.openai.com/account/api-keys',
        placeHolder: 'sk-',
        ignoreFocusOut: true,
    }).then((value) => {
        setKey(value)
        ? activateOpenAI(String(value))
        : vscode.window.showWarningMessage('API key is empty');
    });
}

async function activateOpenAI(key: string) {
    try {

        // Instantiate OpenAI API client
        openai = new OpenAIApi(new Configuration({ apiKey: key.trim() }));

        // Validate API key and connection to OpenAI API server
        await healthCheck();

    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage(`Failed to set API key: ${error}`);
        return false;
    }
    return true;
}

async function healthCheck() {
    let timer: any;
    try {
        return Promise.race([

            // Use list models API to validate API key and connection
            // https://platform.openai.com/docs/api-reference/models
            openai.listModels(),
            new Promise((_, reject) =>
                timer = setTimeout(() => {
                    const errorMessage = `Timeout (>${TIMEOUT/1000}s) while trying to reach OpenAI API server: Service may be down or not available.`;
                    vscode.window.showErrorMessage(errorMessage);
                    reject(new Error(errorMessage));
                }, TIMEOUT)
            )]).catch((error: any) => {

                // check if error is ENOTFOUND
                if (error.code === 'ENOTFOUND') {
                    vscode.window.showErrorMessage(`Could not reach OpenAI API server: You may be offline or the service may be down.`);
                    return false;
                }

                // If API key is invalid, unset it
                if (error.response.status === 401) {
                    console.log(error.response.data);
                    vscode.window.showErrorMessage(error.response.message);
                    unsetKey();
                } else {
                    console.log(error);
                    vscode.window.showErrorMessage(`Encountered error while trying to connect OpenAI API service: ${error}`);
                }
                return false;
            }).finally(() => {
                clearTimeout(timer);
            });
    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage(`Encountered error while trying to activate OpenAI API service: ${error}`);
        return false;
    }
}

function setKey(key: any) {
    if (key.trim().length !== 0) {
        _context.globalState.update('chatsensei.apiKey', encode(key));
        didSetApiKey = true;
        return true;
    }
    return false;
}

function unsetKey(notifyUser: boolean = false) {
    openai = new OpenAIApi(new Configuration());
    _context.globalState.update('chatsensei.apiKey', undefined);
    didSetApiKey = false;
    notifyUser ? vscode.window.showInformationMessage('OpenAI API key has been unset') : null;
}

function codeAction(task: string, text: string) {
    setRole(tasks[task]);
    query(text);
}

function setModel(model: string, notifyUser: boolean = false) {
    openai.listModels().then((response: any) => {
        if (response.data.data.filter((m: any) => m.id === model).length === 0) {
            vscode.window.showErrorMessage(`Model ${model} is not available`);
            return;
        }});
    currentModel = model;
    _context.globalState.update('chatsensei.model', model);
    updateWebviewTitle(`ChatSensei (${model})`);
    notifyUser ? vscode.window.showInformationMessage(`Model set to ${model}`) : null;
}

function setRole(role: Message) {
    role = JSON.parse(JSON.stringify(role));
    delete role.title;
    currentRole = role;
    conversation[0] = currentRole;
}

async function query(content: string) {
    if (processing) { return; }

    if (!didSetApiKey) {
        await requestKey();
    }

    if (openai === undefined) {
        vscode.window.showErrorMessage('OpenAI API client is not initialized');
        return;
    }

    try {

        // Set context for conversation
        setRole(currentRole);
        conversation.push({ role: "user", content: content });

        // Prepare webview panel
        createWebviewPanel(_context, conversation);
        sendWebviewCommand('scroll_to_bottom');
        sendWebviewCommand('disable_input');

        // Create chat completion
        const response = await openai.createChatCompletion(
            {
                model: currentModel,
                messages: conversation,
                stream: true
            }, { responseType: 'stream' });

        // Process stream data
        conversation.push({ role: "assistant", content: '' });
        let buffer: string = '';
        response.data.on('data', (data: { toString: () => string; }) => {
            processing = true;

            // Split stream data into lines and filter out empty lines
            const lines = data.toString().split('\n').filter((line: string) => line.trim() !== '');

            // Process each line of stream data
            for (const line of lines) {

                // Strip 'data: ' prefix from line
                const message = line.replace(/^data: /, '');

                // Stream finished, perform final delta update
                if (message === '[DONE]') {
                    conversation[conversation.length - 1].content = buffer;
                    updateWebviewPanel(conversation);
                    sendWebviewCommand('update_finished');
                    sendWebviewCommand('enable_input');
                    processing = false;
                    return;
                }

                // Parse JSON message, extract content and update buffer
                try {
                    const content = JSON.parse(message).choices[0].delta.content;
                    content !== undefined ? buffer += content : null;
                    conversation[conversation.length - 1].content = buffer;
                } catch (error) {
                    processing = false;
                    console.error('Could not JSON parse stream message', message, error);
                }
            }
            updateWebviewPanel(conversation);
        });
    }
    catch (error: any) {
        didSetApiKey ? await healthCheck() : console.log(error);
        sendWebviewCommand('enable_input');
        processing = false;
    }
}

function resetConversation() {
    conversation = [tasks.default];
    updateWebviewPanel(conversation);
}

// Base64 decoding
function decode(str: any) {
    return String(Buffer.from(String(str), 'base64').toString('binary'));
}

// Base64 encoding
function encode(str: any) {
    return String(Buffer.from(String(str), 'binary').toString('base64'));
}

export { init, requestKey, unsetKey, setModel, setRole, query, codeAction, resetConversation };
