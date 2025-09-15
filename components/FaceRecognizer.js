"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import useLabels from "@/components/useLabels"; // MongoDB hook

export default function FaceRecognizer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { labels: fetchedLabels, loading: labelsLoading, error } = useLabels();

  const [message, setMessage] = useState("Loading models...");
  const [finished, setFinished] = useState(false);
  const [detectedPerson, setDetectedPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confidence, setConfidence] = useState(0);

  const MODEL_URL = "/models";

  // Use labels directly from MongoDB with full image URL
  const labels = fetchedLabels;

  // Retry function
  const handleRetry = () => {
    setFinished(false);
    setMessage("Retrying detection...");
    setDetectedPerson(null);
    setConfidence(0);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    runDetection();
  };

  useEffect(() => {
    let stream;

    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setMessage("Models loaded ✅ Starting webcam...");
      startVideo();
    };

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsLoading(false);
            runDetection();
          };
        }
      } catch (err) {
        console.error("Webcam error:", err);
        setMessage("Cannot access webcam ❌");
        setFinished(true);
        setIsLoading(false);
      }
    };

    if (!labelsLoading && !error && labels.length > 0) loadModels();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // Only run when labels have loaded
  }, [labelsLoading, error]);

  const runDetection = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !labels ||
      labels.length === 0
    )
      return;

    const labeledFaceDescriptors = (
      await Promise.all(
        labels.map(async (student) => {
          try {
            const img = await faceapi.fetchImage(student.image); // full URL from MongoDB
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              return new faceapi.LabeledFaceDescriptors(student.name, [
                detection.descriptor,
              ]);
            }
          } catch {
            console.warn(`Image not found: ${student.name}`);
          }
          return null;
        })
      )
    ).filter(Boolean);

    if (!labeledFaceDescriptors.length) {
      setMessage("No labeled faces found ❌");
      setFinished(true);
      return;
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const displaySize = {
      width: video.videoWidth || 720,
      height: video.videoHeight || 500,
    };
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (resizedDetections.length > 0) {
      const face = resizedDetections[0];
      const bestMatch = faceMatcher.findBestMatch(face.descriptor);
      const label = bestMatch.label === "unknown" ? "Unknown" : bestMatch.label;
      const confidenceScore = Math.round((1 - bestMatch.distance) * 100);

      const box = face.detection.box;
      ctx.strokeStyle = label !== "Unknown" ? "#10b981" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      ctx.fillStyle = label !== "Unknown" ? "#10b981" : "#ef4444";
      ctx.fillRect(box.x, box.y - 30, box.width, 30);

      ctx.fillStyle = "white";
      ctx.font = "16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${label} (${confidenceScore}%)`,
        box.x + box.width / 2,
        box.y - 8
      );

      setMessage(`Detected: ${label}`);
      setConfidence(confidenceScore);

      if (label !== "Unknown") {
        const person = labels.find((l) => l.name === label);
        setDetectedPerson(person || null);
      } else {
        setDetectedPerson(null);
      }
    } else {
      setMessage("No face detected");
      setDetectedPerson(null);
      setConfidence(0);
    }

    setFinished(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Your existing UI remains unchanged */}
      <div className="relative container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <Link href="/register">
              <Button
                variant="outline"
                className="bg-white/80 backdrop-blur-sm border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full"
              >
                Register New Face
              </Button>
            </Link>
          </div>
          <h1 className="text-5xl md:text-7xl font-black">Face Recognition</h1>
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="relative mb-10">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
          <div className="text-center mb-8">
            <span>{message}</span>
          </div>
          {detectedPerson && (
            <div>
              <h3>Recognition Successful!</h3>
              <p>Name: {detectedPerson.name}</p>
              <p>Roll No: {detectedPerson.rollNo}</p>
              <p>Email: {detectedPerson.email}</p>
            </div>
          )}
          {finished && <Button onClick={handleRetry}>Scan Again</Button>}
        </div>
      </div>
    </div>
  );
}
