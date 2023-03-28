/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { createWebviewPanel, sendWebviewCommand, updateWebviewPanel } from './panel';
import { tasks } from './tasks';
const { Configuration, OpenAIApi } = require("openai");
const highlightjs = require('markdown-it-highlightjs');
const md = require('markdown-it')();
md.use(highlightjs);

interface Message {
    role: string;
    content: string;
    title?: string;
}

let openai: any;
let configuration: any;
let _context: vscode.ExtensionContext;
let didSetApiKey: boolean = false;
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
    createWebviewPanel(_context);
    setRole(tasks[task]);

    conversation.push({ role: "user", content: content });
    updateWebviewPanel(flattenMessages(conversation));
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
                    sendWebviewCommand('enable_input');
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
    role = JSON.parse(JSON.stringify(role));
    delete role.title;
    conversation[0] = role;
    updateWebviewPanel(flattenMessages(conversation));
}

function resetConversation() {
    conversation = [tasks.default];
    updateWebviewPanel(flattenMessages(conversation));
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

export { init, requestKey, unsetKey, query, codeAction, resetConversation };
