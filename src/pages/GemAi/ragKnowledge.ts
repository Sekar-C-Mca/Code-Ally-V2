export interface RagNote {
  title: string;
  tags: string[];
  intuition: string;
}

export const ragKnowledge: RagNote[] = [
  {
    title: 'Arrays and two pointers',
    tags: ['array', 'sorted', 'two pointer', 'left', 'right', 'pair', 'subarray'],
    intuition:
      'When the input has order or can be sorted, think about what moving the left or right pointer proves. One pointer usually removes values that are too small, and the other removes values that are too large.',
  },
  {
    title: 'Sliding window',
    tags: ['substring', 'subarray', 'window', 'longest', 'shortest', 'at most', 'frequency'],
    intuition:
      'A window is useful when the answer is a continuous range. Expand until the range becomes useful, then shrink while keeping the condition true or restoring it after it breaks.',
  },
  {
    title: 'Hash map lookup',
    tags: ['hashmap', 'map', 'frequency', 'count', 'duplicate', 'lookup', 'seen'],
    intuition:
      'Use a map when the hard part is remembering something from earlier. Ask what fact would make the current element instantly decide the next move.',
  },
  {
    title: 'Dynamic programming',
    tags: ['dp', 'dynamic', 'memo', 'recursion', 'choice', 'state', 'transition'],
    intuition:
      'DP starts with the question: what small state fully describes the future? If two paths reach the same state, their remaining work should be identical.',
  },
  {
    title: 'Graph search',
    tags: ['graph', 'tree', 'bfs', 'dfs', 'visited', 'path', 'connected'],
    intuition:
      'Model each allowed move as an edge. BFS is for nearest or fewest moves; DFS is for exploring structure, components, or whether a path exists.',
  },
  {
    title: 'Binary search',
    tags: ['binary search', 'sorted', 'minimum', 'maximum', 'answer', 'monotonic'],
    intuition:
      'Binary search works when yes/no changes only once. Do not search for the final value first; search for the boundary where impossible becomes possible.',
  },
  {
    title: 'Stack patterns',
    tags: ['stack', 'monotonic', 'parentheses', 'next greater', 'previous smaller'],
    intuition:
      'A stack helps when recent unresolved items are waiting for a future element. Monotonic stacks keep only candidates that have not been beaten yet.',
  },
  {
    title: 'Greedy reasoning',
    tags: ['greedy', 'interval', 'sort', 'choice', 'minimum', 'maximum'],
    intuition:
      'For greedy, find the local choice that leaves the most freedom for later. Sorting often reveals that one choice dominates another.',
  },
  {
    title: 'Debugging stuck code',
    tags: ['bug', 'wrong answer', 'edge case', 'code', 'test', 'stuck'],
    intuition:
      'Trace the smallest failing case by hand. Watch the variables that represent the invariant, because most bugs are an invariant becoming false silently.',
  },
];

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export const retrieveIntuition = (query: string, limit = 3) => {
  const queryTokens = tokenize(query);

  return ragKnowledge
    .map((note) => {
      const haystack = tokenize(`${note.title} ${note.tags.join(' ')} ${note.intuition}`);
      const score = queryTokens.reduce((total, token) => {
        return total + (haystack.includes(token) ? 1 : 0);
      }, 0);

      return { ...note, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
