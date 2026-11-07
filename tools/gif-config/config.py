"""
GIF Config Pipeline - Configuration

ALL THRESHOLDS HERE ARE STARTING GUESSES TO BE TUNED.
They are NOT validated against real-person data.
Do not report them as validated parameters.
"""

from pathlib import Path
import os
from dotenv import load_dotenv
from pymongo.uri_parser import parse_uri

# ============================================================
# PATHS
# ============================================================
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / 'backend' / '.env')
CACHE_DIR = Path(__file__).parent / "cache"
GIF_CACHE_DIR = CACHE_DIR / "gifs"
LANDMARK_CACHE_DIR = CACHE_DIR / "landmarks"
OUTPUT_DIR = Path(__file__).parent / "output"
REVIEW_SHEETS_DIR = OUTPUT_DIR / "review_sheets"

# MongoDB connection (read-only for catalog)
# Uses EXERCISE_CATALOG_MONGODB_URI from env, falls back to MONGODB_URI
MONGODB_URI = os.getenv("EXERCISE_CATALOG_MONGODB_URI") or os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/physiquequest")
CATALOG_DB_NAME = os.getenv('EXERCISE_CATALOG_DB_NAME') or parse_uri(MONGODB_URI).get('database') or 'test'
CATALOG_COLLECTION = os.getenv('EXERCISE_CATALOG_COLLECTION', 'exercisedb_catalog')

# ============================================================
# DOWNLOAD SETTINGS
# ============================================================
DOWNLOAD_RATE_LIMIT_MS = 1200  # ms between requests (matches backend)
DOWNLOAD_MAX_RETRIES = 3
DOWNLOAD_BACKOFF_BASE = 2.0  # exponential backoff multiplier
DOWNLOAD_TIMEOUT_S = 30

# ============================================================
# MEDIAPIPE SETTINGS
# ============================================================
# Use full model (not lite) for offline analysis
MEDIAPIPE_MODEL_COMPLEXITY = 2  # 0=lite, 1=full, 2=heavy
MEDIAPIPE_MIN_DETECTION_CONFIDENCE = 0.5
MEDIAPIPE_MIN_PRESENCE_CONFIDENCE = 0.5
MEDIAPIPE_MIN_TRACKING_CONFIDENCE = 0.5
MEDIAPIPE_NUM_POSES = 1

# ============================================================
# LANDMARK VISIBILITY & VALIDITY
# ============================================================
# Minimum visibility for a landmark to be considered valid
MIN_LANDMARK_VIS = 0.5

# Minimum fraction of frames where person is detected (any landmarks)
MIN_PERSON_DETECTED_FRACTION = 0.9

# Minimum fraction of valid frames for a joint angle series
MIN_VALID_FRACTION = 0.8

# Maximum gap (in frames) to interpolate
MAX_INTERPOLATION_GAP_FRAMES = 3

# Savitzky-Golay filter window (must be odd) - for smoothing angle series
# Set to 1 to disable (moving average used instead)
SAVGOL_WINDOW = 7
SAVGOL_POLYORDER = 2

# ============================================================
# JOINT ANGLE DEFINITIONS
# ============================================================
# MediaPipe Pose landmarks (33 points)
# Indices: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
LANDMARK_NAMES = {
    0: "nose",
    1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear",
    9: "mouth_left", 10: "mouth_right",
    11: "left_shoulder", 12: "right_shoulder",
    13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist",
    17: "left_pinky", 18: "right_pinky",
    19: "left_index", 20: "right_index",
    21: "left_thumb", 22: "right_thumb",
    23: "left_hip", 24: "right_hip",
    25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle",
    29: "left_heel", 30: "right_heel",
    31: "left_foot_index", 32: "right_foot_index",
}

# Joint angle definitions: (joint_name, point_a, point_b, point_c)
# point_b is the vertex; angle is ABC
JOINT_DEFINITIONS = [
    ("left_elbow", 11, 13, 15),      # left_shoulder, left_elbow, left_wrist
    ("right_elbow", 12, 14, 16),     # right_shoulder, right_elbow, right_wrist
    ("left_shoulder", 23, 11, 13),   # left_hip, left_shoulder, left_elbow
    ("right_shoulder", 24, 12, 14),  # right_hip, right_shoulder, right_elbow
    ("left_hip", 11, 23, 25),        # left_shoulder, left_hip, left_knee
    ("right_hip", 12, 24, 26),       # right_shoulder, right_hip, right_knee
    ("left_knee", 23, 25, 27),       # left_hip, left_knee, left_ankle
    ("right_knee", 24, 26, 28),      # right_hip, right_knee, right_ankle
    ("left_ankle", 25, 27, 31),      # left_knee, left_ankle, left_foot_index
    ("right_ankle", 26, 28, 32),     # right_knee, right_ankle, right_foot_index
    # Trunk inclination: hip midpoint to shoulder midpoint vs vertical
    # Computed separately
]

# Side-specific joint names for bilateral/unilateral analysis
SIDE_JOINTS = {
    "left": ["left_elbow", "left_shoulder", "left_hip", "left_knee", "left_ankle"],
    "right": ["right_elbow", "right_shoulder", "right_hip", "right_knee", "right_ankle"],
}

# ============================================================
# CYCLE DETECTION & REP ANALYSIS
# ============================================================
# Minimum angle range (degrees) for a joint to be considered "moving"
MIN_RANGE_DEG = 25.0

# Prominence threshold for peak detection (fraction of range)
PEAK_PROMINENCE_FRACTION = 0.3

# Minimum number of complete cycles required
MIN_CYCLES = 1

# Percentile range for robust range calculation
PERCENTILE_LOW = 5
PERCENTILE_HIGH = 95

# Start angle: median over first/last 10% of frames
START_END_PERCENTILE = 10

# Stability constraint thresholds
STABLE_MAX_RANGE = 10.0  # degrees - joints with range below this are "stable"
MIN_TOLERANCE = 15.0     # degrees - tolerance band for stable joints

# ============================================================
# ELIGIBILITY THRESHOLDS
# ============================================================
# Minimum valid frame fraction for primary joint
PRIMARY_JOINT_MIN_VALID_FRACTION = 0.8

# Minimum person detection fraction
MIN_PERSON_FRACTION = 0.9

# ============================================================
# VIEW HINT HEURISTIC
# ============================================================
# Ratio of shoulder width to torso length for view classification
# These are heuristic thresholds, not validated
VIEW_HINT_SHOULDER_WIDTH_TORSO_RATIO = {
    "front": (0.8, float('inf')),   # wide shoulders relative to torso
    "side": (0.0, 0.5),             # narrow shoulders
    "unknown": (0.5, 0.8),          # in between
}

# ============================================================
# REASON CODES (machine-readable)
# ============================================================
REASON_CODES = {
    "NO_PERSON": "Person not detected in sufficient frames",
    "LOW_VISIBILITY": "Primary joint landmarks below visibility threshold",
    "NO_CYCLE": "No complete repetition cycle detected",
    "LOW_RANGE": "Primary joint range below minimum threshold",
    "DOWNLOAD_FAILED": "GIF download failed after retries",
    "ISOMETRIC_OR_STRETCH": "Exercise appears isometric or stretch (low movement)",
    "EQUIPMENT_OCCLUSION_SUSPECTED": "Equipment may occlude joints (catalog hint only)",
    "PROCESSING_ERROR": "Unexpected error during processing",
}

# Status values
STATUS_VALUES = {
    "rep_trackable": "Full rep tracking with form constraints",
    "rep_trackable_limited": "Counts reps but form constraints disabled",
    "manual_only": "Manual logging only",
}

# ============================================================
# OUTPUT SETTINGS
# ============================================================
GENERATOR_VERSION = "1.0.0"
REVIEW_SHEET_SAMPLE_SIZE = 40  # stratified across statuses
REVIEW_SHEET_COLS = 5
REVIEW_SHEET_ROWS = 8

# ============================================================
# LOGGING
# ============================================================
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
LOGGER = logging.getLogger("gif-config")
