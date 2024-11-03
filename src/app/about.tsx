"use client";
import Head from "next/head";
import GifDisplay from "./components/GifDisplay"; // Keeping GifDisplay for potential visual aids
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-gray-900 text-gray-100">
      <Head>
        <title>Track Your Medication Side Effects</title>
        <meta
          name="description"
          content="Join our platform to report and track side effects from medications. We use AI to find side effects from sources like Reddit."
        />
        <link rel="icon" href="public/assets/logo.png" />
      </Head>

      {/* Hero Section */}
      <section className="bg-gray-800 py-16 shadow-lg">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Track Your Medication Side Effects with AI
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-6 max-w-[60vw] mx-auto">
            We help you track and report your experiences with medications,
            while using AI to discover unlisted side effects from sources like
            Reddit. Let your voice contribute to better healthcare insights.
          </p>
          <div className="bg-gray-900 text-green-400 font-mono text-lg md:text-xl py-4 px-6 rounded-lg mb-6 inline-block shadow-md cursor-pointer">
            <span className="text-blue-400">Submit</span> Your Experience
          </div>
        </div>
        <div className="flex justify-center mt-2">
          <Link href="/waitlist">
            <span className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition duration-300 cursor-pointer shadow-lg">
              Join Our Community
            </span>
          </Link>
        </div>
      </section>

      {/* GIF Section */}
      <section className="bg-gray-700 py-20 shadow-lg">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            AI-Driven Insights
          </h2>
          <p className="text-lg md:text-xl text-gray-300 mb-6">
            Our AI scrapes forums and communities to find side effects others
            are facing, even when they're not listed in official documentation.
          </p>
          <GifDisplay
            altText="Side Effect Discovery"
            width={400}
            height={300}
          />
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-gray-900 shadow-md">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
          <p className="text-lg text-gray-400 max-w-[60vw] mx-auto">
            We're dedicated to empowering patients by giving them a platform to
            report side effects and compare their experiences with others. By
            using AI to aggregate data from Reddit and other sources, we help
            uncover side effects that are often overlooked.
          </p>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-16 bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Support Our Cause
          </h2>
          <p className="text-lg text-gray-400 mb-6 max-w-[60vw] mx-auto">
            Your support helps us continue developing our AI to improve patient
            outcomes. Whether it's sharing your experience or donating, every
            bit helps us bring hidden side effects to light.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="https://venmo.com/YourLinkHere" // Replace with your actual donation link
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 text-white px-4 py-3 rounded-full hover:bg-green-600 transition duration-300 shadow-lg"
            >
              Donate
            </a>
            <a
              href="https://calendly.com/YourLinkHere" // Replace with your actual Calendly link
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition duration-300 shadow-lg"
            >
              Talk to Us
            </a>
            <a
              href="https://YourSurveyLinkHere" // Replace with your actual survey or waitlist link
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-500 text-white px-6 py-3 rounded-full hover:bg-gray-600 transition duration-300 shadow-lg"
            >
              Join the Waitlist
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 shadow-lg">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2024 Drug Side Effects Tracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
