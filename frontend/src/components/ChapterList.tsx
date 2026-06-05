interface Props {
  chapters: string[]
}

export default function ChapterList({ chapters }: Props) {
  if (chapters.length === 0) return null

  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
      <span>已识别：</span>
      <span className="font-medium text-gray-800">{chapters.length} 个章节</span>
      <span className="text-gray-400">（</span>
      {chapters.map((title, i) => (
        <span key={i}>
          <span className="text-indigo-600">{title}</span>
          {i < chapters.length - 1 && (
            <span className="text-gray-400 mx-1">·</span>
          )}
        </span>
      ))}
      <span className="text-gray-400">）</span>
    </div>
  )
}
