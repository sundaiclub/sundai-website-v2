"use client";
import React, { useState } from "react";
import { XMarkIcon, ShareIcon } from "@heroicons/react/24/outline";
import { Project } from "./Project";

interface ShareModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  project: Project;
  userInfo: any;
  isDarkMode: boolean;
}

const socialPlatforms = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', color: 'bg-black hover:bg-gray-800' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'reddit', name: 'Reddit', icon: '🤖', color: 'bg-orange-600 hover:bg-orange-700' },
];

export default function ShareModal({ showModal, setShowModal, project, userInfo, isDarkMode }: ShareModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customContent, setCustomContent] = useState('');

  const isTeamMember = project.participants.some(p => p.hacker.id === userInfo?.id) || 
                      project.launchLead.id === userInfo?.id;

  const generateContent = async () => {
    setIsGenerating(true);
    try {
      // TODO: This will be implemented in part 3 with the API endpoint
      // For now, we'll create a basic template
      const teamNames = [
        project.launchLead.name, 
        ...project.participants.map(p => p.hacker.name)
      ].join(', ');

      const intro = isTeamMember 
        ? `🚀 We just built ${project.title}!` 
        : `🚀 Check out ${project.title} built by the team at Sundai!`;

      const links = [
        project.demoUrl && `🔗 Demo: ${project.demoUrl}`,
        project.githubUrl && `💻 Code: ${project.githubUrl}`,
        `🌟 More projects: https://sundai.com`
      ].filter(Boolean).join('\n');

      const content = `${intro}

${project.preview}

Built by: ${teamNames}

${links}

#Sundai #TechProjects #Innovation #BuildInPublic`;

      setGeneratedContent(content);
      setCustomContent(content);
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(customContent);
      // TODO: Add toast notification
      alert('Content copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = (platform: string) => {
    const encodedContent = encodeURIComponent(customContent);
    const encodedUrl = encodeURIComponent(project.demoUrl || `https://sundai.com/projects/${project.id}`);
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedContent}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedContent}`;
        break;
      case 'reddit':
        shareUrl = `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(project.title)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${
        isDarkMode ? "bg-gray-800" : "bg-white"
      } rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ShareIcon className="h-6 w-6 mr-2" />
              <h2 className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Share Project
              </h2>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className={`${isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"}`}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Project Info */}
          <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
            <h3 className={`font-semibold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {project.title}
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              {project.preview}
            </p>
          </div>

          {/* Platform Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Choose Platform
            </label>
            <div className="grid grid-cols-3 gap-3">
              {socialPlatforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedPlatform === platform.id
                      ? `${platform.color.split(' ')[0]} border-current text-white`
                      : isDarkMode
                      ? "border-gray-600 text-gray-300 hover:border-gray-500"
                      : "border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <div className="text-2xl mb-1">{platform.icon}</div>
                  <div className="text-sm font-medium">{platform.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Content */}
          <div className="mb-6">
            <button
              onClick={generateContent}
              disabled={isGenerating}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              } disabled:opacity-50`}
            >
              {isGenerating ? "Generating..." : "Generate Content"}
            </button>
          </div>

          {/* Content Preview & Edit */}
          {generatedContent && (
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                Content Preview (Editable)
              </label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={8}
                className={`w-full p-3 border rounded-lg resize-none ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="Generated content will appear here..."
              />
              <div className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                {customContent.length} characters
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {customContent && (
            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                }`}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => handleShare(selectedPlatform)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-white transition-colors ${
                  socialPlatforms.find(p => p.id === selectedPlatform)?.color || 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Share on {socialPlatforms.find(p => p.id === selectedPlatform)?.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 