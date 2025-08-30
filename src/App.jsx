import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
import Tesseract from "tesseract.js";
import "./App.css";

// Fix PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function App() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState([]);
  const [improvement, setImprovement] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryLength, setSummaryLength] = useState("medium"); // short, medium, long

  // File upload
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setText("");
    setSummary([]);
    setImprovement([]);

    if (uploadedFile.type === "application/pdf") {
      await extractTextFromPDF(uploadedFile);
    } else if (uploadedFile.type.startsWith("image/")) {
      await extractTextFromImage(uploadedFile);
    } else {
      alert("Only PDF or Image files are supported!");
    }
  };

  const extractTextFromPDF = async (pdfFile) => {
    const reader = new FileReader();
    reader.onload = async function () {
      const typedArray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      let extractedText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        extractedText += content.items.map((s) => s.str).join(" ") + "\n";
      }
      setText(extractedText);
    };
    reader.readAsArrayBuffer(pdfFile);
  };

  const extractTextFromImage = async (imageFile) => {
    setLoading(true);
    const { data: { text } } = await Tesseract.recognize(imageFile, "eng");
    setText(text);
    setLoading(false);
  };

  // Summarize + Areas of Improvement with clean bullets
  const handleSummarize = async () => {
    if (!text.trim()) return alert("No text found to summarize!");

    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
You are an expert document summarizer. 
Summarize the following text in ${summaryLength} format (short, medium, or long). 

Output format:
- Each point should be on a new line.
- Remove all leading symbols (*, -, •) in bullets.
- Provide separate sections for Summary and Areas of Improvement.

Text:
${text}
      `;

      const result = await model.generateContent(prompt);
      const output = result.response.text();

      // Extract sections
      const summaryMatch = output.match(/Summary[:\s]*([\s\S]*?)\nAreas of Improvement:/i);
      const improvementMatch = output.match(/Areas of Improvement[:\s]*([\s\S]*)$/i);

      // Helper to clean bullets
      const cleanBullets = (text) =>
        text
          .trim()
          .split("\n")
          .map((line) => line.replace(/^[-*•\s]+/, "")) // remove leading symbols
          .filter((b) => b.trim());

      setSummary(summaryMatch ? cleanBullets(summaryMatch[1]) : [output]);
      setImprovement(improvementMatch ? cleanBullets(improvementMatch[1]) : ["No improvement suggestions."]);
    } catch (err) {
      console.error(err);
      alert("Failed to summarize. Check API key or console.");
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <div className="card">
        <h1>📄 Document Summariser</h1>

        {/* File Upload */}
        <label className="upload-label">
          Click or Drag & Drop to Upload PDF/Image
          <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} />
        </label>

        {/* Summary Length Select */}
        {text && (
          <div className="summary-length">
            <label>
              Summary Length:{" "}
              <select value={summaryLength} onChange={(e) => setSummaryLength(e.target.value)}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </label>
          </div>
        )}

        {/* Extracted Text */}
        {text && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Extracted text will appear here..."
          />
        )}

        {/* Summarize Button */}
        <button onClick={handleSummarize} disabled={loading || !text}>
          {loading ? "Processing..." : "Summarize"}
        </button>

        {/* Summary Output */}
        {summary.length > 0 && (
          <>
            <div className="summary">
              <h2>Summary</h2>
              <ul>
                {summary.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>

            <div className="summary">
              <h2>Areas of Improvement</h2>
              <ul>
                {improvement.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
