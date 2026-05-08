import { useState, useRef } from 'react';
import { Button } from 'react-aria-components';

interface DiffLine {
  type: 'equal' | 'remove' | 'add';
  text: string;
}

function computeLineDiff(original: string, changed: string): DiffLine[] {
  const origLines = original.split('\n');
  const changedLines = changed.split('\n');
  const m = origLines.length;
  const n = changedLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        origLines[i] === changedLines[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (origLines[i] === changedLines[j]) {
      result.push({ type: 'equal', text: origLines[i++] });
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'remove', text: origLines[i++] });
    } else {
      result.push({ type: 'add', text: changedLines[j++] });
    }
  }
  while (i < m) result.push({ type: 'remove', text: origLines[i++] });
  while (j < n) result.push({ type: 'add', text: changedLines[j++] });

  return result;
}

export default function TextCompare() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{ left: string; right: string }[]>([{ left: '', right: '' }]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null);

  const getTexts = () => ({
    left: leftRef.current?.innerText ?? '',
    right: rightRef.current?.innerText ?? '',
  });

  const pushHistory = () => {
    const current = getTexts();
    setHistory(prev => [...prev.slice(0, historyIdx + 1), current]);
    setHistoryIdx(i => i + 1);
  };

  const handleUndo = () => {
    if (historyIdx <= 0) return;
    const prev = history[historyIdx - 1];
    if (leftRef.current) leftRef.current.innerText = prev.left;
    if (rightRef.current) rightRef.current.innerText = prev.right;
    setHistoryIdx(i => i - 1);
  };

  const handleRedo = () => {
    if (historyIdx >= history.length - 1) return;
    const next = history[historyIdx + 1];
    if (leftRef.current) leftRef.current.innerText = next.left;
    if (rightRef.current) rightRef.current.innerText = next.right;
    setHistoryIdx(i => i + 1);
  };

  const handleClear = () => {
    if (leftRef.current) leftRef.current.innerText = '';
    if (rightRef.current) rightRef.current.innerText = '';
    setDiffResult(null);
    pushHistory();
  };

  const handleCompare = () => {
    const { left, right } = getTexts();
    setDiffResult(computeLineDiff(left, right));
    pushHistory();
  };

  return (
    <div className="flex flex-col gap-4 p-10">
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="flex gap-2" />
        <div className="flex justify-center">
          <Button
            onPress={handleCompare}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Compare
          </Button>
        </div>
        <div className="flex justify-end items-center gap-3">
          <Button
            onPress={handleUndo}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Undo
          </Button>
          <Button
            onPress={handleRedo}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Redo
          </Button>
          <Button
            onPress={handleClear}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Original Text</label>
          <div className="relative">
            <div
              ref={leftRef}
              contentEditable
              onBlur={pushHistory}
              className="h-[500px] w-full overflow-auto rounded border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <div className="pointer-events-none absolute top-3 left-3 text-sm text-gray-400">
              Paste original text here...
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Changed Text</label>
          <div className="relative">
            <div
              ref={rightRef}
              contentEditable
              onBlur={pushHistory}
              className="h-[500px] w-full overflow-auto rounded border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <div className="pointer-events-none absolute top-3 left-3 text-sm text-gray-400">
              Paste changed text here...
            </div>
          </div>
        </div>
      </div>

      {diffResult && (
        <div className="rounded border border-gray-300 p-4">
          <h2 className="mb-2 text-sm font-semibold">Diff Result</h2>
          <pre className="overflow-auto text-sm">
            {diffResult.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.type === 'add'
                    ? 'bg-green-100 text-green-800'
                    : line.type === 'remove'
                    ? 'bg-red-100 text-red-800'
                    : ''
                }
              >
                {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
                {line.text}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
