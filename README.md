# Lunar Align System

An AI-powered Lunar Telemetry & Surface Alignment System developed for hackathons. This tool mathematically aligns different satellite images (like Chandrayaan-2's OHRC and TMC) taken at different sun angles and scales. It also features Deep Learning topography generation, automated crater density mapping, and Hydration (Ice) detection for Permanently Shadowed Regions (PSRs).

**Developed by: Shanjay, Praisy, Agrima, Naga**

## 🚀 Features
- **Mathematical Alignment:** Uses SIFT, ORB, and LoFTR Transformers to align images.
- **Topography AI:** Uses Intel's `dpt-large` Monocular Depth Estimation to build 3D depth maps.
- **Change Detection:** Automatically highlights anomalies (e.g., meteor impacts) between images.
- **Hydration Mapping:** Isolates deepest PSRs to find high-probability water ice deposits.
- **Telemetry Reports:** Generates downloadable mission logs.

---

## 💻 How to Run Locally

Because this project uses both a React frontend and a heavy Python/AI backend, you need to start **both** servers.

### 1. Start the Backend (Python)
The backend runs the AI models and OpenCV mathematics. You must have Python installed.

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install fastapi uvicorn opencv-python-headless numpy transformers torch pillow pydantic python-multipart
   ```
4. Start the backend server on **Port 8001**:
   ```bash
   python -m uvicorn main:app --port 8001 --reload
   ```

### 2. Start the Frontend (React)
The frontend is built with React, Vite, and TailwindCSS. You must have Node.js installed.

1. Open a **new** terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to `http://localhost:5173/`

*(Note: The first time you run the Terrain AI, it may take a minute to download the 1.3GB Intel AI model into your cache).*
