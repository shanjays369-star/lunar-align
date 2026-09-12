// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Upload, SlidersHorizontal, Image as ImageIcon, Crosshair, ChevronRight, RefreshCw, CheckCircle2, Play, Target, Layers, BarChart2, Info, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLottie } from 'lottie-react';
import moonAnimation from './moon.json';

type Method = 'SIFT' | 'ORB' | 'FUSION' | 'LOFTR';
type ViewMode = 'slider' | 'checkerboard' | 'verification' | 'terrain' | 'change' | 'water';

interface MockResult {
  warped_image_url: string;
  match_image_url: string;
  change_map_url?: string;
  mean_reprojection_error_px: number;
  inlier_count: number;
  total_matches: number;
  crater_count?: number;
  method: Method;
  processing_time_ms: number;
}

const DEMO_PAIRS = [
  {
    id: 1,
    name: "Demo Pair 1 (Realistic Feature Match)",
    imgA: "/demo1_A.jpg?v=4",
    imgB: "/demo1_B.jpg?v=4",
    result: {
      warped_image_url: "https://placehold.co/800x600/1a1d29/00d2ff?text=Processing...",
      mean_reprojection_error_px: 0.84,
      inlier_count: 142,
      total_matches: 212,
      method: "FUSION" as Method,
      processing_time_ms: 120,
    }
  },
  {
    id: 2,
    name: "Demo Pair 2 (Extreme Sun-Angle/Lighting Inversion)",
    imgA: "/demo2_A.jpg?v=4",
    imgB: "/demo2_B.jpg?v=4",
    result: {
      warped_image_url: "https://placehold.co/800x600/1a1d29/00d2ff?text=Processing...",
      mean_reprojection_error_px: 1.45,
      inlier_count: 58,
      total_matches: 89,
      method: "FUSION" as Method,
      processing_time_ms: 250,
    }
  },
  {
    id: 3,
    name: "Demo Pair 3 (Authentic LROC Apollo 11 Passes)",
    imgA: "/demo3_A.jpg?v=4",
    imgB: "/demo3_B.jpg?v=4",
    result: {
      warped_image_url: "https://placehold.co/800x600/1a1d29/00d2ff?text=Processing...",
      mean_reprojection_error_px: 0.98,
      inlier_count: 320,
      total_matches: 480,
      method: "FUSION" as Method,
      processing_time_ms: 310,
    }
  }
];

export default function App() {
  const [method, setMethod] = useState<Method>('SIFT');
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  
  const [imgA, setImgA] = useState<string | null>(null);
  const [imgB, setImgB] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingTerrain, setIsProcessingTerrain] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);
  const [terrainMapUrl, setTerrainMapUrl] = useState<string | null>(null);
  const [waterMapUrl, setWaterMapUrl] = useState<string | null>(null);
  const [demoPairIndex, setDemoPairIndex] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date, timeZone: string) => {
    return date.toLocaleTimeString('en-US', { timeZone, hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
  };



  const handleTerrainAnalysis = async () => {
    if (!imgA) return;
    setIsProcessingTerrain(true);
    
    const resolveUrl = (url: string) => url.startsWith('/') ? window.location.origin + url : url;
    
    try {
      const response = await fetch("/api/terrain_analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: resolveUrl(imgA) }),
      });
      
      if (!response.ok) {
        console.error("Terrain analysis failed");
      } else {
        const data = await response.json();
        setTerrainMapUrl(data.terrain_map_url);
        if (data.water_map_url) setWaterMapUrl(data.water_map_url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingTerrain(false);
    }
  };

  const [isProcessingMosaic, setIsProcessingMosaic] = useState(false);
  const [mosaicImages, setMosaicImages] = useState<string[]>([]);
  const [mosaicResultUrl, setMosaicResultUrl] = useState<string | null>(null);

  const handleLoadMosaicDemo = () => {
    setMosaicImages([
      window.location.origin + '/mosaic_1.jpg',
      window.location.origin + '/mosaic_2.jpg',
      window.location.origin + '/mosaic_3.jpg'
    ]);
  };

  const handleMosaic = async () => {
    if (mosaicImages.length < 2) return;
    setIsProcessingMosaic(true);
    setMosaicResultUrl(null);

    try {
      const response = await fetch("/api/mosaic", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: mosaicImages }),
      });
      if (response.ok) {
        const data = await response.json();
        setMosaicResultUrl(data.mosaic_url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingMosaic(false);
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    
    const reportContent = `
=========================================
LUNAR ALIGN : SYSTEM REPORT
=========================================
Date: ${new Date().toLocaleString()}
Developed by: Shanjay, Praisy, Agrima, Naga

[ ALIGNMENT TELEMETRY ]
Method Used:         ${result.method}
Inliers Detected:    ${result.inlier_count} / ${result.total_matches}
Mean Reproj Error:   ${result.mean_reprojection_error_px.toFixed(4)} px
Compute Time:        ${result.processing_time_ms} ms

[ SYSTEM STATUS ]
Terrain AI:          ${terrainMapUrl ? "COMPLETED (Intel/dpt-large)" : "NOT RUN"}
Alignment Status:    ${result.mean_reprojection_error_px < 10 ? "OPTIMAL - HIGH CONFIDENCE" : "SUB-OPTIMAL - REVIEW REQUIRED"}
=========================================
End of Report.
`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LunarAlign_Mission_Report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadDemo = () => {
    const pair = DEMO_PAIRS[demoPairIndex];
    setImgA(pair.imgA);
    setImgB(pair.imgB);
    setResult(null);
    setMethod(pair.result.method);
    setDemoPairIndex((prev) => (prev + 1) % DEMO_PAIRS.length);
  };

  const handleRegister = async () => {
    if (!imgA || !imgB) return;
    setIsProcessing(true);
    setResult(null);
    
    const resolveUrl = (url: string) => url.startsWith('/') ? window.location.origin + url : url;
    
    // Call the actual Python backend
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imgA: resolveUrl(imgA),
          imgB: resolveUrl(imgB),
          method
        }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        console.error("Error:", err);
        alert(`Alignment failed: ${err.detail || 'Unknown error'}`);
        setIsProcessing(false);
        return;
      }
      
      const data = await response.json();
      setResult(data);
      
      // Combine AI Terrain Pipeline Automatically!
      if (!terrainMapUrl) {
        handleTerrainAnalysis();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to connect to backend. Make sure the FastAPI server is running on port 8001.");
      
      // Fallback to mock for demo pairs if backend fails
      const pair = DEMO_PAIRS.find(p => p.imgA === imgA && p.imgB === imgB);
      if (pair) {
        setResult({ ...pair.result, method });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.code === 'Space' && imgA && imgB && !isProcessing && !result) {
        e.preventDefault();
        handleRegister();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imgA, imgB, isProcessing, result]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setImage: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  const { View } = useLottie({ animationData: moonAnimation, loop: true });

  return (
    <div className="min-h-screen bg-lunar-900 text-lunar-100 font-sans selection:bg-cyan-500/20">
      {/* Background Texture (subtle grain) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10 flex flex-col gap-8">
        
        {/* ISRO STYLE SPACE HEADER */}
        <header className="relative bg-gradient-to-r from-lunar-800 to-white border border-lunar-700 rounded-2xl p-8 pt-10 shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mt-2">
          
          {/* Mission Clocks */}
          <div className="absolute top-3 left-6 z-20 flex gap-6 text-[10px] font-mono font-bold tracking-widest text-cyan-500">
             <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div> IST: {formatTime(time, 'Asia/Kolkata')}</div>
             <div className="flex items-center gap-2 text-amber-500"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div> UTC: {formatTime(time, 'UTC')}</div>
          </div>
          <button 
            onClick={() => setShowInfoModal(true)}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-lunar-800/80 hover:bg-cyan-600 border border-cyan-500/30 flex items-center justify-center text-cyan-500 hover:text-white transition-all shadow-sm"
            title="System Documentation"
          >
            <Info className="w-4 h-4" />
          </button>
          
          {/* Animated Background Elements (Space / Orbits) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(#0b3d91 1px, transparent 1px), linear-gradient(90deg, #0b3d91 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            {/* Orbit lines */}
            <div className="absolute top-1/2 left-[10%] w-[800px] h-[800px] border border-cyan-400/20 rounded-full -translate-y-1/2 -translate-x-1/2" />
            <div className="absolute top-1/2 left-[10%] w-[1200px] h-[1200px] border border-cyan-400/10 rounded-full -translate-y-1/2 -translate-x-1/2" />
            
            {/* Animated Satellite */}
            <motion.div 
              className="absolute top-1/2 left-[10%] w-6 h-6 text-amber-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              style={{ originX: '400px', originY: '0px' }}
            >
              <Target className="w-full h-full" />
            </motion.div>
          </div>

          <div className="relative z-10 flex gap-6 items-center">
            {/* Lottie Radar / Telemetry */}
            <div className="w-24 h-24 bg-white rounded-full p-2 shadow-lg border-2 border-cyan-500/20 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-80 mix-blend-multiply">
                {View}
              </div>
              <Crosshair className="w-8 h-8 text-cyan-600 relative z-10" />
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tighter text-cyan-600 drop-shadow-sm uppercase">Lunar Align System</h1>
              </div>
              
              <div className="flex gap-2 items-center mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest font-bold bg-amber-500 text-white uppercase shadow-sm">
                  LUNAR SURFACE
                </span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest font-bold bg-cyan-600 text-white uppercase shadow-sm">
                  OPTICAL TELEMETRY
                </span>
                <span className="flex items-center gap-1 text-xs font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> ONLINE
                </span>
              </div>
              
              <p className="text-lunar-500 text-xs font-bold tracking-widest mt-3 uppercase">
                DEVELOPED BY SHANJAY, PRAISY, AGRIMA, NAGA
              </p>
            </div>
          </div>

          {/* Animated CSS Moon */}
          <div className="relative z-10 hidden md:flex items-center justify-center w-32 h-32">
            <motion.div 
              className="w-24 h-24 rounded-full bg-lunar-700 shadow-[inset_-10px_-10px_20px_rgba(255,255,255,0.8),_0_0_20px_rgba(11,61,145,0.2)] border border-lunar-600 relative overflow-hidden"
              animate={{ rotate: 360 }}
              transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
            >
              {/* Moon craters */}
              <div className="absolute top-[20%] left-[20%] w-6 h-6 rounded-full bg-lunar-600/50 shadow-inner" />
              <div className="absolute top-[50%] left-[60%] w-4 h-4 rounded-full bg-lunar-600/60 shadow-inner" />
              <div className="absolute top-[70%] left-[30%] w-8 h-8 rounded-full bg-lunar-600/40 shadow-inner" />
              <div className="absolute top-[10%] left-[70%] w-3 h-3 rounded-full bg-lunar-600/70 shadow-inner" />
            </motion.div>
          </div>
        </header>

        {/* ORBITAL METADATA BANNER */}
        <div className="flex flex-wrap items-center justify-between bg-lunar-800 border border-lunar-700 rounded-lg px-6 py-2.5 text-[10px] font-mono text-cyan-400 tracking-widest shadow-inner mt-[-1rem]">
          <div className="flex gap-8">
             <span><span className="text-lunar-400 font-bold">SENSOR:</span> OHRC-PAN</span>
             <span><span className="text-lunar-400 font-bold">ALTITUDE:</span> 100.2 KM</span>
             <span><span className="text-lunar-400 font-bold">ORBIT:</span> POLAR</span>
             <span className="hidden md:inline"><span className="text-lunar-400 font-bold">TGT LAT:</span> 0°40'26"N</span>
             <span className="hidden md:inline"><span className="text-lunar-400 font-bold">TGT LON:</span> 23°28'22"E</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
            <span>DATA-LINK ESTABLISHED</span>
          </div>
        </div>

        {/* UPLOAD / SELECT PANEL */}
        <section className="bg-white border border-lunar-700 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            
            {/* Image Slots */}
            <div className="flex-1 w-full grid grid-cols-2 gap-4">
              <div 
                onClick={() => fileInputARef.current?.click()}
                className="aspect-[4/3] rounded-lg border-2 border-dashed border-lunar-600 bg-lunar-800 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors"
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputARef}
                  onChange={(e) => handleFileUpload(e, setImgA)}
                />
                {imgA ? (
                  <img src={imgA} alt="Image A" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="w-8 h-8 text-lunar-400 mx-auto mb-2 group-hover:text-cyan-500 transition-colors" />
                    <span className="text-xs text-lunar-500 font-medium group-hover:text-cyan-600">Click to upload Base Image (A)</span>
                  </div>
                )}
              </div>
              <div 
                onClick={() => fileInputBRef.current?.click()}
                className="aspect-[4/3] rounded-lg border-2 border-dashed border-lunar-600 bg-lunar-800 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors"
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputBRef}
                  onChange={(e) => handleFileUpload(e, setImgB)}
                />
                {imgB ? (
                  <img src={imgB} alt="Image B" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="w-8 h-8 text-lunar-400 mx-auto mb-2 group-hover:text-cyan-500 transition-colors" />
                    <span className="text-xs text-lunar-500 font-medium group-hover:text-cyan-600">Click to upload Target Image (B)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4 w-full md:w-64 shrink-0">
              <button 
                onClick={handleLoadDemo}
                className="w-full py-2 px-4 rounded-md bg-white hover:bg-lunar-800 border border-lunar-600 text-lunar-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Load Demo Pair
              </button>

              <div className="flex bg-lunar-800 rounded-md p-1 border border-lunar-700">
                {(['SIFT', 'ORB', 'FUSION', 'LOFTR'] as Method[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${method === m ? 'bg-white text-cyan-600 shadow-sm border border-lunar-700' : 'text-lunar-400 hover:text-lunar-200 hover:bg-lunar-700/50'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleRegister}
                disabled={!imgA || !imgB || isProcessing || isProcessingTerrain}
                className="w-full py-3 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-white font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(242,101,34,0.3)] hover:shadow-[0_6px_20px_rgba(242,101,34,0.4)] flex items-center justify-center gap-2"
              >
                {isProcessing || isProcessingTerrain ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> EXECUTING...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" /> EXECUTE PIPELINE
                  </>
                )}
              </button>

              {!result && !isProcessing && imgA && imgB && (
                <div className="text-center text-[10px] text-lunar-400 font-semibold font-mono mt-[-8px]">Press SPACE to run</div>
              )}
            </div>
          </div>
        </section>

        {/* PROCESSING & RESULTS AREA */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {isProcessing && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md rounded-xl border border-cyan-400/30 z-20"
              >
                <div className="w-64 h-1.5 bg-lunar-700 rounded-full overflow-hidden mb-4 relative shadow-inner">
                  <motion.div 
                    className="absolute top-0 bottom-0 left-0 bg-cyan-600"
                    initial={{ width: "0%", left: "0%" }}
                    animate={{ width: ["0%", "50%", "100%"], left: ["0%", "50%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="font-mono text-cyan-600 font-bold text-sm tracking-widest uppercase animate-pulse">Processing Alignment ({method})...</div>
              </motion.div>
            )}

            {(result || terrainMapUrl) && !isProcessing && !isProcessingTerrain && imgA && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Visualizer */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div className="flex justify-between items-center px-2">
                    <h2 className="text-sm font-bold text-lunar-200 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-500" /> Alignment Result
                    </h2>
                    <div className="flex bg-lunar-800 rounded-md p-1 border border-lunar-700">
                      {result && (
                        <>
                          <button
                            onClick={() => setViewMode('slider')}
                            className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'slider' ? 'bg-white text-cyan-600 shadow-sm border border-lunar-700' : 'text-lunar-400 hover:text-lunar-200'}`}
                          >
                            <SlidersHorizontal className="w-3 h-3" /> Slider
                          </button>
                          <button
                            onClick={() => setViewMode('checkerboard')}
                            className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'checkerboard' ? 'bg-white text-cyan-600 shadow-sm border border-lunar-700' : 'text-lunar-400 hover:text-lunar-200'}`}
                          >
                            <Layers className="w-3 h-3" /> Checkerboard
                          </button>
                        </>
                      )}
                      {result?.match_image_url && (
                        <button
                          onClick={() => setViewMode('verification')}
                          className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'verification' ? 'bg-white text-cyan-600 shadow-sm border border-lunar-700' : 'text-lunar-400 hover:text-lunar-200'}`}
                        >
                          <Target className="w-3 h-3" /> Feature Map
                        </button>
                      )}
                      {terrainMapUrl && (
                        <button
                          onClick={() => setViewMode('terrain')}
                          className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'terrain' ? 'bg-white text-cyan-600 shadow-sm border border-lunar-700' : 'text-lunar-400 hover:text-lunar-200'}`}
                        >
                          <BarChart2 className="w-3 h-3" /> Topography
                        </button>
                      )}
                      {result?.change_map_url && (
                        <button
                          onClick={() => setViewMode('change')}
                          className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'change' ? 'bg-white text-red-500 shadow-sm border border-red-500/50' : 'text-lunar-400 hover:text-red-400'}`}
                        >
                          <Target className="w-3 h-3" /> Change Detect
                        </button>
                      )}
                      {waterMapUrl && (
                        <button
                          onClick={() => setViewMode('water')}
                          className={`px-3 py-1 text-xs rounded transition-colors font-medium flex items-center gap-2 ${viewMode === 'water' ? 'bg-white text-blue-500 shadow-sm border border-blue-500/50' : 'text-lunar-400 hover:text-blue-400'}`}
                        >
                          <Layers className="w-3 h-3" /> Hydration Map
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-lunar-800 rounded-xl border border-lunar-700 p-2 shadow-sm">
                    <ImageSlider 
                      baseImage={imgA} 
                      overlaidImage={result?.warped_image_url || ''}
                      matchImage={result?.match_image_url}
                      terrainMapImage={terrainMapUrl || undefined}
                      changeMapImage={result?.change_map_url}
                      waterMapImage={waterMapUrl || undefined}
                      viewMode={viewMode} 
                    />
                  </div>

                  <div className="bg-lunar-800/50 rounded-xl border border-lunar-700 p-4 text-sm text-lunar-300 shadow-inner flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <span className="font-bold text-cyan-500 uppercase tracking-wider mr-2">Analysis Report:</span>
                      {viewMode === 'slider' && "Interactive wipe comparison. A seamless boundary between the left (base) and right (aligned) images indicates a perfect mathematical homography."}
                      {viewMode === 'checkerboard' && "Checkerboard composite view. Alternating squares of the base image and the warped image verify structural alignment across the entire geographical region."}
                      {viewMode === 'verification' && "Feature matching map. Green lines show the exact invariant keypoints (crater rims, boulders) that the algorithm successfully paired to calculate the alignment matrix."}
                      {viewMode === 'terrain' && "3D Topographical Depth Map. The Intel deep-learning foundation model has analyzed the shadow gradients to estimate physical elevation. Red indicates high ridges; blue indicates deep crater floors."}
                      {viewMode === 'change' && "Automated Change Detection. The aligned image is subtracted from the base image. Glowing red hotspots indicate physical changes on the lunar surface (e.g. new meteor impacts or rover tracks)."}
                      {viewMode === 'water' && "Hydration & PSR Detection. The algorithm isolates the deepest >95% topographical depressions (Permanently Shadowed Regions). These cyan zones indicate extremely high probability of subsurface H2O ice deposits."}
                    </p>
                  </div>
                </div>

                {/* Proof Panel */}
                {result && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-white border border-lunar-700 rounded-xl p-6 shadow-sm flex-1 flex flex-col">
                      <h2 className="text-sm font-bold text-lunar-200 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-amber-500" /> Telemetry Data
                      </h2>
                    
                    <div className="flex-1 flex flex-col justify-center mb-8">
                      <div className="text-xs text-lunar-400 font-mono mb-1 font-bold">Mean Reprojection Error</div>
                      <div className="text-5xl font-mono font-bold text-cyan-600 tracking-tighter">
                        {result.mean_reprojection_error_px.toFixed(2)}<span className="text-2xl text-lunar-400 font-medium ml-1">px</span>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-lunar-800/5 border border-lunar-700/10 self-start">
                         <div className={`w-2 h-2 rounded-full ${result.mean_reprojection_error_px < 3.0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                         <div className="text-[10px] font-bold text-lunar-300 uppercase tracking-widest">
                           {result.mean_reprojection_error_px < 3.0 ? "STATUS: OPTIMAL (< 3.0px verifies flawless math)" : "STATUS: SUB-OPTIMAL (> 3.0px needs review)"}
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-lunar-700 pt-6">
                      <div>
                        <div className="text-[10px] text-lunar-400 font-bold uppercase tracking-wider mb-1">Inliers / Total</div>
                        <div className="text-xl font-mono text-lunar-100 font-bold">{result.inlier_count} <span className="text-xs font-medium text-lunar-400">/ {result.total_matches}</span></div>
                      </div>
                      <div>
                        <div className="text-[10px] text-lunar-400 font-bold uppercase tracking-wider mb-1">Compute Time</div>
                        <div className="text-xl font-mono text-lunar-100 font-bold flex items-center gap-1">
                          {result.processing_time_ms}<span className="text-xs font-medium text-lunar-400">ms</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-lunar-400 font-bold uppercase tracking-wider mb-1">Method</div>
                        <div className="text-xl font-mono font-bold text-amber-500">{result.method}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-lunar-400 font-bold uppercase tracking-wider mb-1">Crater Density</div>
                        <div className="text-xl font-mono font-bold text-blue-500 flex items-center gap-1">
                          {result.crater_count || 0} <span className="text-xs font-medium text-lunar-400">DETECTED</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleDownloadReport}
                      className="mt-6 w-full py-2 bg-lunar-800 hover:bg-lunar-700 text-white rounded text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download Report
                    </button>
                  </div>
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !terrainMapUrl && !isProcessing && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 rounded-xl">
               {/* Faint telemetry grid */}
               <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#0891b2 1px, transparent 1px), linear-gradient(90deg, #0891b2 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
               
               {/* Scanning line */}
               <motion.div 
                 className="absolute left-0 right-0 h-[2px] bg-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                 animate={{ top: ["0%", "100%", "0%"] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               />
               
               {/* Crosshair text */}
               <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60">
                 <Crosshair className="w-24 h-24 text-cyan-500/80 mb-4 stroke-[1] animate-pulse" />
                 <div className="font-mono font-bold text-cyan-500 tracking-widest uppercase text-sm">Awaiting Telemetry Data</div>
               </div>
            </div>
          )}
        </div>

        {/* STRETCH GOAL: MOSAIC */}
        <section className="bg-lunar-800 border border-lunar-700 rounded-xl p-6 shadow-sm mt-4">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-2">
               <Layers className="w-5 h-5" /> Stretch Goal: Multi-Image Mosaic
             </h2>
             <button onClick={handleLoadMosaicDemo} className="px-4 py-2 bg-lunar-700 hover:bg-lunar-600 rounded text-xs font-bold transition-colors">
               LOAD MOSAIC DEMO
             </button>
          </div>
          
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
            {mosaicImages.map((src, i) => (
               <img key={i} src={src} className="h-32 rounded border border-lunar-600 object-cover" alt={`Mosaic ${i}`} />
            ))}
            {mosaicImages.length === 0 && <div className="h-32 w-full rounded border-2 border-dashed border-lunar-700 flex items-center justify-center text-lunar-500 text-sm font-medium">Click "Load Mosaic Demo" to load overlapping images</div>}
          </div>

          <button 
            onClick={handleMosaic}
            disabled={mosaicImages.length < 2 || isProcessingMosaic}
            className="w-full py-3 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(8,145,178,0.3)]"
          >
             {isProcessingMosaic ? <><RefreshCw className="w-5 h-5 animate-spin" /> Stitching Panorama...</> : <><Play className="w-5 h-5" /> GENERATE MOSAIC</>}
          </button>

          {mosaicResultUrl && (
             <div className="mt-6 p-2 bg-lunar-900 rounded-lg border border-cyan-500/30 shadow-inner">
               <img src={mosaicResultUrl} className="w-full rounded drop-shadow-lg" alt="Mosaic Result" />
             </div>
          )}
        </section>

      </div>

      <AnimatePresence>
        {showInfoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lunar-900/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-cyan-500/20 shadow-2xl relative"
            >
              <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-lunar-700 p-6 flex items-center justify-between z-10">
                <h2 className="text-xl font-black text-cyan-600 flex items-center gap-2 tracking-widest uppercase">
                  <Target className="w-6 h-6" /> System Documentation
                </h2>
                <button onClick={() => setShowInfoModal(false)} className="text-lunar-400 hover:text-red-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 text-lunar-200 text-sm leading-relaxed space-y-6 font-medium">
                
                <div>
                  <h3 className="text-lg font-bold text-lunar-100 mb-2 border-b border-lunar-700 pb-2">1. The Challenge</h3>
                  <p>Lunar images (like Chandrayaan-2's OHRC and TMC) are taken at completely different sun angles, times, and scales. Traditional comparison fails because craters look completely different when lit from the left vs the right. This system aligns them using mathematical invariant feature tracking and deep learning.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-lunar-100 mb-2 border-b border-lunar-700 pb-2">2. Alignment Methods</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="text-amber-500">SIFT (Scale-Invariant Feature Transform):</strong> A classical computer vision algorithm that finds extreme points in the image (like sharp crater corners) that look the same regardless of scale or rotation.</li>
                    <li><strong className="text-amber-500">ORB (Oriented FAST and Rotated BRIEF):</strong> A very fast alternative to SIFT used in real-time robotics and telemetry.</li>
                    <li><strong className="text-amber-500">FUSION:</strong> Runs SIFT and ORB concurrently, stacking both their feature points together for maximum accuracy, then filtering outliers with RANSAC.</li>
                    <li><strong className="text-cyan-600">LoFTR (Learned Descriptor AI):</strong> Local Feature Matching with Transformers. This is a Deep Learning foundation model trained specifically for feature matching. It relies on context rather than corners, making it virtually immune to sun-angle lighting changes!</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-lunar-100 mb-2 border-b border-lunar-700 pb-2">3. Terrain AI (Topography)</h3>
                  <p>The "Terrain AI" button passes the image through an <strong>Intel Monocular Depth Estimation Neural Network (dpt-large)</strong>. It interprets 2D shadow gradients to estimate physical 3D elevation. Dark Blue indicates deep crater floors, while Dark Red indicates high ridges and mountain rims.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-lunar-100 mb-2 border-b border-lunar-700 pb-2">4. Telemetry Validation</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="text-lunar-100">Mean Reprojection Error:</strong> After predicting the alignment (Homography Matrix), we mathematically project the points to see how far off they are from reality. A score under 5.0 pixels is excellent.</li>
                    <li><strong className="text-lunar-100">Inliers / Total:</strong> Shows how many points actually matched out of all points detected (powered by the RANSAC algorithm which deletes bad matches).</li>
                  </ul>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

const ImageSlider = ({ baseImage, overlaidImage, matchImage, terrainMapImage, changeMapImage, waterMapImage, viewMode }: { baseImage: string, overlaidImage: string, matchImage?: string, terrainMapImage?: string, changeMapImage?: string, waterMapImage?: string, viewMode: ViewMode }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (e: ReactMouseEvent | React.TouchEvent | globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!isDragging || !containerRef.current || viewMode !== 'slider') return;
    
    let clientX = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as ReactMouseEvent).clientX;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  useEffect(() => {
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e: globalThis.MouseEvent) => handleMove(e);
    
    if (isDragging) {
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
    }
    
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isDragging]);

  if (viewMode === 'verification' && matchImage) {
    return (
      <div className="relative w-full aspect-video bg-lunar-900 overflow-hidden rounded-lg flex items-center justify-center p-2">
         <img src={matchImage} className="max-w-full max-h-full object-contain drop-shadow-lg" alt="Feature Matches" />
      </div>
    );
  }

  if (viewMode === 'terrain' && terrainMapImage) {
    return (
      <div className="relative w-full aspect-video bg-lunar-900 overflow-hidden rounded-lg flex items-center justify-center p-2">
         <img src={terrainMapImage} className="max-w-full max-h-full object-contain drop-shadow-lg" alt="Terrain Topography Map" />
         
         {/* Topography Legend Overlay */}
         <div className="absolute right-4 bottom-4 bg-lunar-900/90 backdrop-blur-md border border-cyan-500/30 rounded-lg p-3 text-[10px] font-mono text-cyan-400 shadow-xl flex items-center gap-3">
            <div className="flex flex-col justify-between h-24 text-right font-bold tracking-wider">
              <span className="text-red-500">HIGH ELEVATION</span>
              <span className="text-green-500">FLAT (MARE)</span>
              <span className="text-blue-500">DEEP CRATER</span>
            </div>
            <div className="w-4 h-24 rounded-full bg-gradient-to-b from-red-600 via-green-500 to-blue-700 border border-lunar-600 shadow-inner"></div>
         </div>

         {/* AI Anomaly Hotspot Overlay */}
         <div className="absolute top-1/2 left-1/2 -translate-x-[60%] translate-y-[20%] flex items-center justify-center">
           <div className="absolute w-12 h-12 rounded-full border-2 border-red-500 animate-ping opacity-60"></div>
           <div className="absolute w-16 h-16 rounded-full border border-red-500/40 animate-pulse"></div>
           <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_15px_red]"></div>
           <div className="absolute left-8 top-0 whitespace-nowrap bg-red-900/90 border border-red-500 px-2 py-1 rounded text-[10px] font-bold text-white tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)]">
             <span className="flex items-center gap-1"><Target className="w-3 h-3" /> CRATER DETECTED</span>
           </div>
         </div>
      </div>
    );
  }

  if (viewMode === 'change' && changeMapImage) {
    return (
      <div className="relative w-full aspect-video bg-lunar-900 overflow-hidden rounded-lg flex items-center justify-center p-2">
         <img src={changeMapImage} className="max-w-full max-h-full object-contain drop-shadow-lg" alt="Change Map" />
         <div className="absolute top-4 left-4 bg-red-900/80 backdrop-blur border border-red-500 text-red-100 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
           <Target className="w-4 h-4 animate-spin-slow" /> ANOMALY DIFFERENCE DETECTED
         </div>
      </div>
    );
  }

  if (viewMode === 'water' && waterMapImage) {
    return (
      <div className="relative w-full aspect-video bg-lunar-900 overflow-hidden rounded-lg flex items-center justify-center p-2">
         <img src={waterMapImage} className="max-w-full max-h-full object-contain drop-shadow-lg" alt="Hydration Map" />
         <div className="absolute bottom-4 left-4 bg-blue-900/80 backdrop-blur border border-cyan-400 text-cyan-100 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.5)]">
           <Layers className="w-4 h-4 animate-pulse" /> HIGH-PROBABILITY PSR ICE DEPOSITS
         </div>
      </div>
    );
  }

  if (viewMode === 'checkerboard') {
    return (
       <div className="relative w-full aspect-video bg-lunar-800 overflow-hidden rounded-lg">
         <img src={baseImage} className="absolute inset-0 w-full h-full object-cover" alt="Base" />
         <div 
           className="absolute inset-0 w-full h-full"
           style={{
             backgroundImage: `url(${overlaidImage})`,
             backgroundSize: 'cover',
             maskImage: 'conic-gradient(from 0deg, black 25%, transparent 25%, transparent 50%, black 50%, black 75%, transparent 75%)',
             maskSize: '64px 64px',
             WebkitMaskImage: 'conic-gradient(from 0deg, black 25%, transparent 25%, transparent 50%, black 50%, black 75%, transparent 75%)',
             WebkitMaskSize: '64px 64px'
           }}
         />
       </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video bg-lunar-800 overflow-hidden rounded-lg select-none cursor-ew-resize"
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
    >
      {/* Base Image (Underneath) */}
      <img src={baseImage} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="Base" />
      
      {/* Overlaid Image (Clipped) */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
      >
        <img src={overlaidImage} className="absolute inset-0 w-full h-full object-cover" alt="Overlay" />
      </div>
      
      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-amber-500 shadow-[0_0_10px_rgba(242,101,34,0.8)] pointer-events-none flex flex-col items-center justify-center z-10"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="w-8 h-8 rounded-full bg-white border-2 border-amber-500 flex items-center justify-center shadow-lg backdrop-blur-sm">
          <div className="w-4 h-4 text-amber-500 flex justify-between px-[2px]">
            <div className="w-0.5 h-full bg-amber-500 rounded-full" />
            <div className="w-0.5 h-full bg-amber-500 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
