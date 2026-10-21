'use client';

import type { ProjectJudgingOption } from '@/types/judging';

export default function JudgingTrackSelect({
  judging,
  trackId,
  onTrackChange,
  isDarkMode,
}: {
  judging: ProjectJudgingOption;
  trackId: string;
  onTrackChange: (trackId: string) => void;
  isDarkMode: boolean;
}) {
  const track = judging.tracks.find(item => item.id === trackId);

  return (
    <div>
      <label
        className={`block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        htmlFor="judging-track"
      >
        Track *
      </label>
      <select
        id="judging-track"
        required
        value={trackId}
        onChange={event => onTrackChange(event.target.value)}
        className={`mt-1 block w-full max-w-md rounded-md border p-2 ${
          isDarkMode
            ? 'border-gray-600 bg-gray-900 text-gray-100'
            : 'border-gray-300 bg-white text-gray-900'
        }`}
      >
        <option value="">Choose a track</option>
        {judging.tracks.map(item => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {track?.description && (
        <p
          className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          {track.description}
        </p>
      )}
    </div>
  );
}
