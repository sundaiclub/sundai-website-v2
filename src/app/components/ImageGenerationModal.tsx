"use client";
import React, { useState } from "react";
import { XMarkIcon, SparklesIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import toast from "react-hot-toast";

interface ImageGenerationModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  onImageSelect: (imageUrl: string) => void;
  isDarkMode: boolean;
}

export default function ImageGenerationModal({
  showModal,
  setShowModal,
  projectId,
  projectTitle,
  projectDescription,
  onImageSelect,
  isDarkMode,
}: ImageGenerationModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const generateImages = async () => {
    setIsGenerating(true);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/generate-images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: "Generate pixel-art thumbnails based on project description" }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate images");
      }

      const data = await response.json();
      setGeneratedImages(data.images);
      setSelectedImageIndex(null);
      toast.success("Images generated successfully!");
    } catch (error) {
      console.error("Error generating images:", error);
      toast.error("Failed to generate images");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageSelect = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleConfirmSelection = () => {
    if (selectedImageIndex !== null && generatedImages[selectedImageIndex]) {
      onImageSelect(generatedImages[selectedImageIndex]);
      setShowModal(false);
      // Reset state
      setGeneratedImages([]);
      setSelectedImageIndex(null);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    // Reset state
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    setIsGenerating(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto ${
        isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
      } rounded-lg shadow-xl`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-purple-500" />
              AI Image Generator
            </h2>
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg hover:bg-gray-100 ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
              }`}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Project Info */}
            <div className={`p-4 rounded-lg ${
              isDarkMode ? "bg-gray-700" : "bg-gray-50"
            }`}>
              <h3 className="font-semibold mb-2">Project: {projectTitle}</h3>
              <p className="text-sm opacity-80">{projectDescription}</p>
              <p className={`text-xs mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                💡 Tip: Update your project description to get different image styles and concepts
              </p>
            </div>

            {/* Loading State */}
            {isGenerating && (
              <div className="text-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className={`animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 ${
                    isDarkMode ? "border-purple-400" : "border-purple-600"
                  }`}></div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Generating Your Images...</h3>
                    <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Creating 4 unique pixel-art thumbnails based on your project
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Images Button - Only show when not generating and no images */}
            {!isGenerating && generatedImages.length === 0 && (
              <div>
                <h3 className="font-semibold mb-3">Generate AI Thumbnails</h3>
                <button
                  onClick={generateImages}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-purple-600 hover:bg-purple-700 text-white`}
                >
                  <SparklesIcon className="h-5 w-5" />
                  AI Generate
                </button>
                <p className={`mt-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  AI will create 4 unique pixel-art thumbnails based on your project description
                </p>
              </div>
            )}

            {/* Generated Images */}
            {!isGenerating && generatedImages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Select Your Favorite</h3>
                  <button
                    onClick={generateImages}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                      isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Generate New
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((imageUrl, index) => (
                    <div
                      key={index}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIndex === index
                          ? "border-purple-500 ring-2 ring-purple-200"
                          : isDarkMode
                          ? "border-gray-600 hover:border-gray-500"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => handleImageSelect(index)}
                    >
                      <div className="aspect-video relative">
                        <Image
                          src={imageUrl}
                          alt={`Generated image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      {selectedImageIndex === index && (
                        <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className={`p-2 text-center text-sm font-medium ${
                        isDarkMode ? "bg-gray-700" : "bg-gray-50"
                      }`}>
                        Option {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Selection */}
            {!isGenerating && selectedImageIndex !== null && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleConfirmSelection}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  Use This Image
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
