interface Props {
  progress: number
  chapters: string[]
  currentChapter?: number
}

export default function ProgressDisplay({ progress, chapters, currentChapter }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          {currentChapter
            ? `正在处理：${chapters[currentChapter - 1]} (${
                currentChapter
              }/${chapters.length})`
            : '转换中...'}
        </h3>
        <span className="text-sm font-mono text-indigo-600">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
