'use client';

import MarkdownEditor from './MarkdownEditor';
import JudgingTrackSelect from './JudgingTrackSelect';
import {
  ADDITIONAL_INFO_KEY,
  type JudgingAnswers,
  type ProjectJudgingOption,
} from '@/types/judging';

/**
 * Replaces the project's long description for judged events: participants
 * pick a track and answer its questions, and the answers become the description.
 */
export default function JudgingSubmissionFields({
  eventTitle,
  judging,
  trackId,
  answers,
  onTrackChange,
  onAnswerChange,
  isDarkMode,
}: {
  eventTitle: string;
  judging: ProjectJudgingOption;
  trackId: string;
  answers: JudgingAnswers;
  onTrackChange: (trackId: string) => void;
  onAnswerChange: (key: string, value: string) => void;
  isDarkMode: boolean;
}) {
  const track = judging.tracks.find(item => item.id === trackId);
  const labelClass = `block font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const mutedClass = `text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`;

  return (
    <section
      aria-labelledby="judging-submission-heading"
      className={`space-y-4 rounded-lg border p-4 ${
        isDarkMode
          ? 'border-gray-700 bg-gray-800'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div>
        <h2 id="judging-submission-heading" className="font-medium">
          Judging submission for {eventTitle}
        </h2>
        <p className={`mt-1 ${mutedClass}`}>
          This event is judged. Your answers below become your project&apos;s
          full description.
        </p>
      </div>

      <JudgingTrackSelect
        judging={judging}
        trackId={trackId}
        onTrackChange={onTrackChange}
        isDarkMode={isDarkMode}
      />

      {track && (
        <>
          {track.questions.map(question => (
            <div key={question.id}>
              <label className={labelClass}>
                {question.prompt}
                {question.required ? ' *' : ''}
              </label>
              <MarkdownEditor
                label={question.prompt}
                value={answers[question.id] ?? ''}
                onChange={value => onAnswerChange(question.id, value)}
                rows={5}
                required={question.required}
                placeholder="Write your answer in Markdown..."
              />
            </div>
          ))}
          <div>
            <label className={labelClass}>Additional info</label>
            <p className={mutedClass}>Anything else the judges should know.</p>
            <MarkdownEditor
              label="Additional info"
              value={answers[ADDITIONAL_INFO_KEY] ?? ''}
              onChange={value => onAnswerChange(ADDITIONAL_INFO_KEY, value)}
              rows={5}
            />
          </div>
        </>
      )}
    </section>
  );
}
