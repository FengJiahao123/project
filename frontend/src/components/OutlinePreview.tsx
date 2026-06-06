import type { OutlineResponse } from '../types'

interface Props {
  outline: OutlineResponse
  onConfirm: (adjustments?: string) => void
  onRetry: () => void
  loading: boolean
}

export default function OutlinePreview({ outline, onConfirm, onRetry, loading }: Props) {
  const roleLabel = (role: string) => {
    switch (role) {
      case 'protagonist': return '主角'
      case 'supporting': return '配角'
      case 'extra': return '龙套'
      default: return role
    }
  }

  const roleColor = (role: string) => {
    switch (role) {
      case 'protagonist': return 'bg-amber-100 text-amber-700'
      case 'supporting': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-200 text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          📋 大纲预览
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onRetry}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            🔄 重新分析
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            ✅ 确认大纲，开始生成
          </button>
        </div>
      </div>

      {/* Chapter titles */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <span>📖 已识别 {outline.chapter_titles.length} 个章节：</span>
        {outline.chapter_titles.map((t, i) => (
          <span key={i}>
            <span className="font-medium text-indigo-600">{t}</span>
            {i < outline.chapter_titles.length - 1 && <span className="mx-1 text-gray-300">·</span>}
          </span>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-5 p-3 bg-gray-50 rounded-lg">
        <StatBadge label="预计场景" value={outline.total_scenes.toString()} />
        <StatBadge label="预计角色" value={outline.character_preview.length.toString()} />
        <StatBadge label="章节数" value={outline.chapter_outlines.length.toString()} />
      </div>

      {/* Scene breakdown by chapter */}
      <div className="space-y-4 mb-5">
        {outline.chapter_outlines.map((ch, chi) => (
          <div key={chi} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">
                📄 {ch.chapter_title}
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  {ch.scenes.length} 个场景
                </span>
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {ch.scenes.map((scene) => (
                <div key={scene.scene_number} className="px-4 py-3 hover:bg-indigo-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      {scene.scene_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">
                          {scene.location_name}
                        </span>
                        <span className="text-xs text-gray-400">— {scene.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{scene.summary}</p>
                      {scene.key_dialogue_preview && (
                        <p className="text-xs text-indigo-500 mt-1 italic">
                          💬 "{scene.key_dialogue_preview}"
                        </p>
                      )}
                      {scene.characters_involved.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {scene.characters_involved.map((name) => (
                            <span key={name} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Character preview */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          👤 预计角色（{outline.character_preview.length}人）
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {outline.character_preview.map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-800">{c.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColor(c.role_guess)}`}>
                {roleLabel(c.role_guess)}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">场景{c.first_appearance_scene}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis notes */}
      {outline.analysis_notes && (
        <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700 leading-relaxed">
          💡 {outline.analysis_notes}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
        <button
          onClick={onRetry}
          disabled={loading}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          🔄 重新分析
        </button>
        <button
          onClick={() => onConfirm()}
          disabled={loading}
          className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          ✅ 确认大纲，开始生成剧本
        </button>
      </div>
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg font-bold text-indigo-600">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
