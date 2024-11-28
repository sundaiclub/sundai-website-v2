import React, { useState, useCallback } from 'react';
import { useTheme } from "../contexts/ThemeContext";
import { toast } from 'react-hot-toast';

export default function TagSelector({ 
    show, 
    onClose, 
    tags, 
    selectedTags, 
    onSelect,
    type,
    allowCreate = true
  }: {
    show: boolean;
    onClose: () => void;
    tags: Array<{ id: string; name: string; _count?: { projects: number } }>;
    selectedTags: Array<{ id: string }>;
    onSelect: (id: string, type: 'tech' | 'domain') => void;
    type: 'tech' | 'domain';
    allowCreate?: boolean;
  }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const { isDarkMode } = useTheme();
    
    const handleCreateTag = useCallback(async (name: string) => {
      // Check for duplicate names
      const isDuplicate = tags.some(
        tag => tag.name.toLowerCase() === name.toLowerCase()
      );
      
      if (isDuplicate) {
        toast.error('A tag with this name already exists');
        return;
      }

      setIsCreating(true);
      try {
        const response = await fetch(`/api/tags/${type}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          throw new Error('Failed to create tag');
        }

        const newTag = await response.json();
        toast.success('Tag created successfully');
        onSelect(newTag.id, type);
        onClose();
      } catch (error) {
        console.error('Error creating tag:', error);
        toast.error('Failed to create tag');
      } finally {
        setIsCreating(false);
      }
    }, [tags, type, onSelect, onClose]);

    if (!show) return null;

    const filteredTags = tags
      .filter(tag => !selectedTags.some(st => st.id === tag.id))
      .filter(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg max-w-md w-full max-h-[80vh]`}>
          <h3 className="text-lg font-bold mb-4">Select Tags</h3>
          
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-3 py-2 mb-4 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100' 
                : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-gray-300'
            }`}
          />

          <div className="max-h-[40vh] overflow-y-auto">
            {allowCreate && searchTerm && (
              <button
                onClick={() => handleCreateTag(searchTerm)}
                disabled={isCreating}
                className={`block w-full text-left px-4 py-2 rounded font-medium ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-indigo-400' 
                    : 'hover:bg-gray-100 text-indigo-600'
                } ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCreating ? 'Creating...' : `+ Create tag "${searchTerm}"`}
              </button>
            )}

            {filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    onSelect(tag.id, type);
                    onClose();
                  }}
                  className={`block w-full text-left px-4 py-2 rounded ${
                    isDarkMode 
                      ? 'hover:bg-gray-700' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <span>{tag.name}</span>
                  <span className={`float-right ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {tag._count?.projects || 0}
                  </span>
                </button>
              ))
            ) : (
              <p className={`text-center py-4 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {searchTerm ? 'No matching tags found' : 'No tags available'}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  };
