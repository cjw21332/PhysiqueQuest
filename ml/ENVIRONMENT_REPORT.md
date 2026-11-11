# Phase 0: Environment Report

## Hardware & OS
- **OS**: Windows 11 (PowerShell)
- **CPU**: AMD Ryzen 5 5600 (6 cores, 12 logical processors)
- **GPU**: NVIDIA GeForce RTX 3050 (6 GB VRAM, CUDA 13.3)
- **RAM**: 32 GB (34,282,184,704 bytes)
- **Disk**: C: 931 GB total, 346 GB free (364 GB)
- **Python**: 3.12.10
- **pip**: 25.0.1
- **CUDA available**: Yes (nvidia-smi shows driver 610.88, CUDA 13.3)

## Repo Scan Results

### Key Files Analyzed
1. **pose.worker.ts** (Web Worker for MediaPipe Pose)
   - Uses `@mediapipe/tasks-vision` v0.10.32
   - Model: `pose_landmarker_lite.task` (BlazePose Lite)
   - Running mode: VIDEO
   - Thresholds: minPoseDetectionConfidence=0.6, minPosePresenceConfidence=0.6, minTrackingConfidence=0.6
   - Delegates: CPU (WASM)
   - Output: 33 landmarks with x, y, visibility (no z in generic-frame output)

2. **genericRepCounter.ts** (shared/GenericRepCounter)
   - State machine: AT_START → MOVING → AT_PEAK → RETURNING → AT_START
   - Full range threshold: 85% (device-tier adjustable)
   - Fault persistence: 250ms
   - Visibility grace period: 500ms
   - Device tiers: low=5 FPS, medium=10 FPS, high=15 FPS
   - Battery-aware: reduce at 20%, critical at 10%

3. **exercise-registry.ts** (backend/pose-tracker)
   - TrackingConfig schema with trackingMode: builtin|reference|generated-angle|unavailable
   - 40+ providerExercises mapped
   - GeneratedAngleConfig from GIF analysis pipeline

4. **exercisedb.service.ts** (backend/exercises)
   - Fetches from https://oss.exercisedb.dev/api/v1
   - RawExercise fields: exerciseId, name, gifUrl, bodyParts[], equipments[], targetMuscles[], secondaryMuscles[], instructions[]
   - Normalized to ExerciseRecord with computed fields

5. **catalog-sync.service.ts**
   - MongoDB collections: exercisedb_catalog, exercisedb_sync
   - Incremental sync with cursor-based pagination

6. **/pose/analyze** (backend/pose)
   - POST endpoint with 28MB body limit
   - Validates video duration (max 120s) and size (max 20MB)
   - Uses external provider (POSE_ANALYSIS_URL + POSE_ANALYSIS_API_KEY)
   - Optional Gemini review for exercise identification

### Existing Contracts
- TrackingConfig with limitations always including: "Camera cannot assess pain, injury risk or equipment load"
- GeneratedAngleConfig structure matches GenericRepCounter input
- AnalysisReport expects: metrics, joints[], observations[], exerciseReview, movementEstimate

## Mobile Workflow
- **Frontend**: Next.js 16.4.5 + React 19.3.0
- **MediaPipe**: @mediapipe/tasks-vision 0.10.32 (WASM in Web Worker)
- **No Expo/React Native** in frontend - this is a PWA/Next.js app
- **WebView bridge**: `ReactNativeWebView` messages for native communication (used in LiveSession.tsx)
- **Build target**: Web (Next.js), potentially wrapped in Capacitor/Ionic for mobile

## Connectivity
- ✅ pypi.org reachable
- ✅ huggingface.co reachable
- ✅ oss.exercisedb.dev reachable (ExerciseDB API)

## Path Selection
**Chosen: Path A (WebView + Web Worker + onnxruntime-web)**
- Reasoning: 
  - Frontend is Next.js/PWA, not Expo/React Native
  - Existing MediaPipe runs in Web Worker (WASM)
  - onnxruntime-web (WASM/WebGPU) can run classifier in same worker
  - No native build pipeline needed
  - Lower risk, works in browser and PWA

## Next Steps
1. Phase 1: Create Python environment with pinned requirements
2. Phase 2: Fetch ExerciseDB catalog and create ML mapping
3. Phase 3: Data acquisition from verified sources