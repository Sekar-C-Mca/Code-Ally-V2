import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, KeyRound, Send, Sparkles, Trash2, User } from 'lucide-react';
import Navbar from '../../components/Navbar';
import CopyrightFooter from '../../components/CopyrightFooter';
import { retrieveIntuition } from './ragKnowledge';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const API_KEY_STORAGE = 'gemai_api_key';
const GEMINI_MODEL = 'gemini-2.5-flash';

const buildPrompt = (message: string, context: string, hintNumber: number) => `
You are GemAi inside CodeAlly. Help competitive programmers by giving intuition only.

Rules:
- Start directly with hints. No greeting.
- Do not give the full solution.
- Do not write complete code.
- Do not reveal final algorithm steps as a tutorial.
- Give exactly one short hint.
- Start with "Hint ${hintNumber}:".
- Do not reveal later hints.
- Hint 1 should be a gentle direction.
- Hint 2 should point toward a useful pattern or invariant.
- Hint 3 should mention an edge case or deeper observation without giving the solution.
- Do not use markdown bold, tables, or long paragraphs.
- If code is pasted, point to the likely thinking mistake or invariant to inspect.
- Be direct and concise.

Retrieved intuition notes:
${context}

User is stuck here:
${message}
`;

const codingSignals = [
  'array',
  'string',
  'tree',
  'graph',
  'dp',
  'dynamic',
  'recursion',
  'binary',
  'search',
  'sort',
  'stack',
  'queue',
  'hash',
  'map',
  'window',
  'pointer',
  'sum',
  'leetcode',
  'codeforces',
  'gfg',
  'brute',
  'optimal',
  'complexity',
  'edge',
  'case',
];

const lowInfoMessages = ['hi', 'hello', 'hey', 'help', 'ok', 'okay', 'thanks', 'thank you', 'any intuition for me'];

const hasCodeShape = (message: string) => /[{}();=]|\bfor\b|\bwhile\b|\bif\b|\breturn\b/.test(message);

const hasProblemContext = (message: string) => {
  const normalized = message.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(Boolean);

  if (lowInfoMessages.includes(normalized)) {
    return false;
  }

  return words.length >= 8 || hasCodeShape(normalized) || codingSignals.some((signal) => normalized.includes(signal));
};

const getGeminiText = async (apiKey: string, message: string, context: string, hintNumber: number) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(message, context, hintNumber) }],
          },
        ],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 500,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage = errorBody?.error?.message || 'Gemini request failed.';
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim() || 'I could not generate an intuition for that. Try adding the problem statement or where you are stuck.'
  );
};

export default function GemAi() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [input, setInput] = useState('');
  const [lastProblem, setLastProblem] = useState('');
  const [hintStep, setHintStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Paste your problem, where you are stuck, or your code. I will give one intuition hint at a time.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const retrievedNotes = useMemo(() => retrieveIntuition(input || lastProblem || ''), [input, lastProblem]);

  const saveApiKey = (value: string) => {
    setApiKey(value);
    if (value.trim()) {
      localStorage.setItem(API_KEY_STORAGE, value.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setError('Add your Gemini API key first.');
      return;
    }

    if (!trimmedInput) {
      setError('Tell GemAi what problem or code is blocking you.');
      return;
    }

    setError('');
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: trimmedInput }]);

    const hasFreshProblem = hasProblemContext(trimmedInput);

    if (!hasFreshProblem && !lastProblem) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            'Paste the problem statement, your stuck point, or your code first. Then I can give intuition without giving away the full answer.',
        },
      ]);
      return;
    }

    const effectiveMessage = hasFreshProblem ? trimmedInput : `${lastProblem}\n\nFollow-up question: ${trimmedInput}`;
    const nextHintStep = hasFreshProblem ? 1 : Math.min(hintStep + 1, 3);

    if (hasFreshProblem) {
      setLastProblem(trimmedInput);
    }

    setHintStep(nextHintStep);

    setLoading(true);

    const context = retrieveIntuition(effectiveMessage)
      .map((note) => `${note.title}: ${note.intuition}`)
      .join('\n');

    try {
      const reply = await getGeminiText(trimmedKey, effectiveMessage, context, nextHintStep);
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (requestError) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            requestError instanceof Error
              ? requestError.message
              : 'GemAi could not respond right now. Check your API key and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]"
          >
            <aside className="space-y-6">
              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-red-500" />
                  <h1 className="text-lg font-bold text-gray-900">GemAi Key</h1>
                </div>
                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 inline-flex text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Get Gemini API key
                </a>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => saveApiKey(event.target.value)}
                  placeholder="Paste Gemini API key"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
                <p className="mt-3 text-sm text-gray-500">Stored only in this browser for local chat requests.</p>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-bold text-gray-900">RAG Intuition</h2>
                </div>
                <div className="space-y-3">
                  {retrievedNotes.map((note) => (
                    <div key={note.title} className="border-l-4 border-red-400 bg-red-50 px-3 py-2">
                      <div className="font-semibold text-gray-900">{note.title}</div>
                      <p className="mt-1 text-sm text-gray-600">{note.intuition}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <section className="flex min-h-[680px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">GemAi Intuition Chat</h2>
                    <p className="mt-1 text-sm text-gray-500">Ask for direction, then type next hint when you need more.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLastProblem('');
                      setHintStep(0);
                      setMessages([
                        {
                          role: 'assistant',
                          content:
                            'Paste your problem, where you are stuck, or your code. I will give one intuition hint at a time.',
                        },
                      ]);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[780px] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'bg-red-500 text-white'
                          : 'border border-gray-200 bg-gray-50 text-gray-800'
                      }`}
                    >
                      {message.content}
                    </div>
                    {message.role === 'user' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Bot className="h-5 w-5 text-red-500" />
                    Thinking about the intuition...
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
                {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Paste the problem, your stuck point, or code..."
                    rows={3}
                    className="min-h-[88px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-500 px-5 font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300 sm:self-end"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </form>
            </section>
          </motion.div>
        </div>
      </main>
      <CopyrightFooter />
    </>
  );
}
