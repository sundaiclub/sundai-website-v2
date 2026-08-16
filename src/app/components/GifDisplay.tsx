"use client";
import React, { KeyboardEvent, useState } from "react";
import Image from "next/image";

const gifPath1 = "/assets/standard_workflow.gif";
const gifPath2 = "/assets/pip-ai_workflow.gif";

type GifDisplayProps = {
  altText?: string;
  width: number;
  height: number;
};

const GifDisplay = ({ altText = "GIF", width, height }: GifDisplayProps) => {
  const [currentGif, setCurrentGif] = useState(gifPath1); // Default to the first GIF
  const [isToggled, setIsToggled] = useState(false); // Track the toggle state

  const toggleGif = () => {
    setIsToggled(!isToggled);
    setCurrentGif(isToggled ? gifPath1 : gifPath2);
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      toggleGif();
    }
  };

  return (
    <div className="flex flex-col justify-center items-center mb-[-3rem]">
      <Image
        src={currentGif}
        alt={altText}
        width={width}
        height={height}
        className="rounded-lg shadow-lg"
        quality={100} // Ensures the image quality is high
      />
      <div className="mt-6">
        <div
          className={`w-16 h-6 rounded-full p-1 cursor-pointer ${
            isToggled ? "bg-blue-500" : "bg-gray-400"
          }`}
          onClick={toggleGif}
          onKeyPress={handleKeyPress}
          role="button"
          tabIndex={0}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${
              isToggled ? "translate-x-10" : "translate-x-0"
            }`}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default GifDisplay;
