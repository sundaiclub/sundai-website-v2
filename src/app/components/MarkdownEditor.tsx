'use client';
import { useId, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BoldIcon,
  ItalicIcon,
  PhotoIcon,
  LinkIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import ProjectMarkdown from './ProjectMarkdown';
import {
  getImageUploadError,
  validateImageUploadSize,
} from '@/lib/imageUploads';
type UploadImageResponse = { url: string };
const uploadImage = async (file: File): Promise<string> => {
  const sizeError = validateImageUploadSize(file);
  if (sizeError) throw new Error(sizeError);

  const loadingToast = toast.loading('Uploading image...');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);

  try {
    const response = await fetch('/api/uploads/image', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(
        await getImageUploadError(response, 'Failed to upload image')
      );
    }
    const data = (await response.json()) as UploadImageResponse;
    return data.url;
  } finally {
    toast.dismiss(loadingToast);
  }
};

export default function MarkdownEditor({
  value: editableDescription,
  onChange: setEditableDescription,
  label,
  id,
  rows = 15,
  maxLength,
  required = false,
  placeholder = 'Write Markdown here...',
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const { isDarkMode } = useTheme();
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const [descriptionView, setDescriptionView] = useState<'write' | 'preview'>(
    'write'
  );
  return (
    <div>
      <span
        className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
      >
        Supports{' '}
        <a
          href="https://www.markdownguide.org/basic-syntax"
          target="_blank"
          rel="noopener noreferrer"
        >
          Markdown
        </a>
        ! Use the toolbar.
      </span>
      <div
        className={`mt-2 flex items-center justify-between gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
      >
        <div className="flex gap-2">
          <button
            type="button"
            disabled={descriptionView === 'preview'}
            onClick={() => {
              const textarea = document.getElementById(
                textareaId
              ) as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              const replacement = selectedText
                ? `**${selectedText}**`
                : '**Bold text**';
              setEditableDescription(
                text.substring(0, start) + replacement + text.substring(end)
              );
              setTimeout(() => {
                textarea.focus();
                if (selectedText) {
                  textarea.selectionStart = start + 2;
                  textarea.selectionEnd = start + 2 + selectedText.length;
                } else {
                  textarea.selectionStart = start + 2;
                  textarea.selectionEnd = start + 10;
                }
              }, 0);
            }}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            title="Bold (Ctrl+B)"
          >
            <BoldIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={descriptionView === 'preview'}
            onClick={() => {
              const textarea = document.getElementById(
                textareaId
              ) as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              const replacement = selectedText
                ? `*${selectedText}*`
                : '*Italic text*';
              setEditableDescription(
                text.substring(0, start) + replacement + text.substring(end)
              );
              setTimeout(() => {
                textarea.focus();
                if (selectedText) {
                  textarea.selectionStart = start + 1;
                  textarea.selectionEnd = start + 1 + selectedText.length;
                } else {
                  textarea.selectionStart = start + 1;
                  textarea.selectionEnd = start + 11;
                }
              }, 0);
            }}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            title="Italic (Ctrl+I)"
          >
            <ItalicIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={descriptionView === 'preview'}
            onClick={() => {
              const textarea = document.getElementById(
                textareaId
              ) as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              const replacement = selectedText
                ? `~~${selectedText}~~`
                : '~~Struck text~~';
              setEditableDescription(
                text.substring(0, start) + replacement + text.substring(end)
              );
              setTimeout(() => {
                textarea.focus();
                if (selectedText) {
                  textarea.selectionStart = start + 2;
                  textarea.selectionEnd = start + 2 + selectedText.length;
                } else {
                  textarea.selectionStart = start + 2;
                  textarea.selectionEnd = start + 13;
                }
              }, 0);
            }}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            title="Strikethrough"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center text-sm font-bold line-through">
              S
            </span>
          </button>
          <button
            type="button"
            disabled={descriptionView === 'preview'}
            onClick={() => {
              const textarea = document.getElementById(
                textareaId
              ) as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              const replacement = selectedText
                ? `[${selectedText}](url)`
                : '[Link](url)';
              setEditableDescription(
                text.substring(0, start) + replacement + text.substring(end)
              );
              setTimeout(() => {
                textarea.focus();
                if (selectedText) {
                  textarea.selectionStart = start + selectedText.length + 3;
                  textarea.selectionEnd = start + selectedText.length + 6;
                } else {
                  textarea.selectionStart = start + 7;
                  textarea.selectionEnd = start + 10;
                }
              }, 0);
            }}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            title="Add Link"
          >
            <LinkIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={descriptionView === 'preview'}
            onClick={() => {
              const textarea = document.getElementById(
                textareaId
              ) as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              const replacement = `\`${selectedText}\``;
              setEditableDescription(
                text.substring(0, start) + replacement + text.substring(end)
              );
              setTimeout(() => {
                textarea.focus();
                textarea.selectionStart = start + 1;
                textarea.selectionEnd = start + 1 + selectedText.length;
              }, 0);
            }}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            title="Inline Code"
          >
            <CodeBracketIcon className="h-5 w-5" />
          </button>
          <label
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
              descriptionView === 'preview'
                ? 'pointer-events-none opacity-50'
                : ''
            }`}
            title="Upload Image"
          >
            <PhotoIcon className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={descriptionView === 'preview'}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    const imageUrl = await uploadImage(file);
                    const textarea = document.getElementById(
                      textareaId
                    ) as HTMLTextAreaElement;
                    const start = textarea.selectionStart;
                    const text = textarea.value;
                    const imageMarkdown = `![Image](${imageUrl})`;
                    setEditableDescription(
                      text.substring(0, start) +
                        imageMarkdown +
                        text.substring(start)
                    );
                    setTimeout(() => {
                      textarea.focus();
                      textarea.selectionStart = textarea.selectionEnd =
                        start + imageMarkdown.length;
                    }, 0);
                  } catch (error) {
                    console.error('Error uploading image:', error);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Failed to upload image'
                    );
                  }
                }
              }}
            />
          </label>
        </div>
        <div
          className={`inline-flex overflow-hidden rounded-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
        >
          {(['write', 'preview'] as const).map(view => (
            <button
              key={view}
              type="button"
              onClick={() => setDescriptionView(view)}
              className={`px-3 py-1.5 text-sm font-medium capitalize ${
                descriptionView === view
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-100'
                    : 'bg-gray-100 text-gray-900'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              aria-pressed={descriptionView === view}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
      {descriptionView === 'write' ? (
        <textarea
          id={textareaId}
          aria-label={label}
          maxLength={maxLength}
          required={required}
          value={editableDescription}
          onChange={e => setEditableDescription(e.target.value)}
          onKeyDown={e => {
            if (e.ctrlKey || e.metaKey) {
              const textarea = e.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              const selectedText = text.substring(start, end);
              switch (e.key.toLowerCase()) {
                case 'b':
                  e.preventDefault();
                  const boldText = `**${selectedText}**`;
                  setEditableDescription(
                    text.substring(0, start) + boldText + text.substring(end)
                  );
                  setTimeout(() => {
                    textarea.selectionStart = start + 2;
                    textarea.selectionEnd = start + 2 + selectedText.length;
                  }, 0);
                  break;
                case 'i':
                  e.preventDefault();
                  const italicText = `*${selectedText}*`;
                  setEditableDescription(
                    text.substring(0, start) + italicText + text.substring(end)
                  );
                  setTimeout(() => {
                    textarea.selectionStart = start + 1;
                    textarea.selectionEnd = start + 1 + selectedText.length;
                  }, 0);
                  break;
                case 'x':
                  if (!e.shiftKey) break;
                  e.preventDefault();
                  const strikeText = `~~${selectedText}~~`;
                  setEditableDescription(
                    text.substring(0, start) + strikeText + text.substring(end)
                  );
                  setTimeout(() => {
                    textarea.selectionStart = start + 2;
                    textarea.selectionEnd = start + 2 + selectedText.length;
                  }, 0);
                  break;
              }
            }
          }}
          onPaste={async e => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find(item =>
              item.type.startsWith('image/')
            );
            if (imageItem) {
              e.preventDefault();
              const file = imageItem.getAsFile();
              if (file) {
                try {
                  const textarea = e.currentTarget;
                  const imageUrl = await uploadImage(file);
                  const start = textarea.selectionStart;
                  const text = textarea.value;
                  const imageMarkdown = `![Image](${imageUrl})`;
                  setEditableDescription(
                    text.substring(0, start) +
                      imageMarkdown +
                      text.substring(start)
                  );
                  setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd =
                      start + imageMarkdown.length;
                    textarea.focus();
                  }, 0);
                } catch (error) {
                  console.error('Error uploading image:', error);
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Failed to upload image'
                  );
                }
              }
            }
          }}
          onDragOver={e => {
            e.preventDefault();
            e.currentTarget.classList.add('border-indigo-500');
          }}
          onDragLeave={e => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-indigo-500');
          }}
          onDrop={async e => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-indigo-500');
            const textarea = e.currentTarget;
            textarea.focus();

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              try {
                const imageUrl = await uploadImage(file);
                toast.success('Image uploaded successfully');

                const start = textarea.selectionStart || textarea.value.length;
                const text = textarea.value;
                const imageMarkdown = `![${file.name}](${imageUrl})`;
                setEditableDescription(
                  text.substring(0, start) +
                    imageMarkdown +
                    text.substring(start)
                );

                const newPosition = start + imageMarkdown.length;
                textarea.selectionStart = newPosition;
                textarea.selectionEnd = newPosition;
                return;
              } catch (error) {
                console.error('Error uploading image:', error);
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Failed to upload image'
                );
                return;
              }
            }

            const urlData =
              e.dataTransfer.getData('text/uri-list') ||
              e.dataTransfer.getData('text/plain');
            if (
              urlData &&
              (urlData.startsWith('http://') || urlData.startsWith('https://'))
            ) {
              const isImageUrl = /\.(jpg|jpeg|png|gif|webp)$/i.test(urlData);
              if (isImageUrl) {
                const start = textarea.selectionStart || textarea.value.length;
                const text = textarea.value;
                const filename = urlData.split('/').pop() || 'image';
                const imageMarkdown = `![${filename}](${urlData})`;
                setEditableDescription(
                  text.substring(0, start) +
                    imageMarkdown +
                    text.substring(start)
                );

                const newPosition = start + imageMarkdown.length;
                textarea.selectionStart = newPosition;
                textarea.selectionEnd = newPosition;
              }
            }
          }}
          className={`mt-1 block w-full border ${
            isDarkMode
              ? 'border-gray-600 bg-gray-800 text-gray-100'
              : 'border-gray-300 bg-white text-gray-900'
          } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2`}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <ProjectMarkdown
          markdown={editableDescription}
          className={`mt-1 min-h-[390px] w-full rounded-md border p-4 prose prose-lg max-w-none ${
            isDarkMode
              ? 'border-gray-600 bg-gray-800 text-gray-100 prose-invert prose-pre:bg-gray-900 prose-a:text-indigo-400'
              : 'border-gray-300 bg-white text-gray-900 prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600'
          }`}
        />
      )}
    </div>
  );
}
