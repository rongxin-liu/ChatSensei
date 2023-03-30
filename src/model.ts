/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { createWebviewPanel, sendWebviewCommand, updateWebviewPanel } from './panel';
import { tasks } from './tasks';
const { Configuration, OpenAIApi } = require("openai");

export interface Message {
    role: string;
    content: string;
    title?: string;
}

const TIMEOUT = 5000; // ms

let openai: any;
let configuration: any;
let _context: vscode.ExtensionContext;
let didSetApiKey: boolean = false;
let processing: boolean = false;
export let conversation: Message[] = [tasks.default];

async function init(context: vscode.ExtensionContext) {
    _context = context;
    const key = context.globalState.get('chatsensei.apiKey');
    key !== undefined ? activateOpenAI(decode(key)) : null;
}

async function requestKey() {
    await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key. https://platform.openai.com/account/api-keys',
        placeHolder: 'sk-',
        ignoreFocusOut: true,
    }).then((value) => {
        value?.trim().length !== 0
        ? activateOpenAI(String(value))
        : vscode.window.showWarningMessage('API key is empty');
    });
}

async function activateOpenAI(key: string) {
    try {

        // Instantiate OpenAI API client
        openai = new OpenAIApi(new Configuration({ apiKey: key.trim() }));

        // Validate API key and connection to OpenAI API server
        if (await healthCheck()) {
            _context.globalState.update('chatsensei.apiKey', encode(key));
            didSetApiKey = true;
        }

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
                    const errorMessage = `Timeout (${TIMEOUT}ms) while trying to reach OpenAI API server: Service may be down or not available.`;
                    vscode.window.showErrorMessage(errorMessage);
                    reject(new Error(errorMessage));
                }, TIMEOUT)
            )]).catch((error: any) => {

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

function unsetKey(notifyUser: boolean = false) {
    openai = new OpenAIApi(new Configuration());
    _context.globalState.update('chatsensei.apiKey', undefined);
    didSetApiKey = false;
    notifyUser ? vscode.window.showInformationMessage('OpenAI API key has been unset') : null;
}

function codeAction(task: string, text: string) {
    query(text, task);
}

async function query(content: string, task: string = 'default') {
    if (processing) { return; }

    if (!didSetApiKey) {
        await requestKey();
    }

    if (openai === undefined) {
        vscode.window.showErrorMessage('OpenAI API client is not initialized');
        return;
    }

    createWebviewPanel(_context);
    setRole(tasks[task]);

    conversation.push({ role: "user", content: content });
    updateWebviewPanel(conversation);
    sendWebviewCommand('scroll_to_bottom');
    sendWebviewCommand('disable_input');
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

function setRole(role: Message) {
    role = JSON.parse(JSON.stringify(role));
    delete role.title;
    conversation[0] = role;
    updateWebviewPanel(conversation);
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

export { init, requestKey, unsetKey, query, codeAction, resetConversation };
