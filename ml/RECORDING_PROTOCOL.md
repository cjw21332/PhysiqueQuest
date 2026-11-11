# Phase 3: Data Acquisition

## Verified Sources

### 1. ExerciseDB GIFs (MANDATORY BACKBONE)
- **Source**: `https://oss.exercisedb.dev/media/{exerciseId}.gif`
- **License**: To be verified - check https://oss.exercisedb.dev terms
- **Items**: 1500 GIFs fetched
- **Label**: `exerciseId` from catalog
- **Status**: ✅ Downloaded, can be used as reference signatures (not as primary training data until license verified)
- **Note**: ExerciseDB data is 100% covered; see BLOCKERS.md for license investigation

### 2. Own Recorded Videos (REQUIRED FOR VALIDATION)
- **Protocol**: See `ml/RECORDING_PROTOCOL.md`
- **Status**: ⏳ Pending human action (B1 in BLOCKERS.md)
- **Required**: ≥3 subjects × ≥5 clips × 8-12 reps each, front + side views, mixed lighting, 20 exercises
- **Coverage**: This is the held-out test set, never used for training

### 3. Hugging Face Datasets (Search Results)
| Repo ID | Size | License | Relevance | Status |
|---------|------|---------|-----------|--------|
| `hf-uci-har` | ~500 MB | MIT | 6 activities (walk, run, etc.) | ⏳ Need to check subset |
| `hf-fit-exercises` | ~2 GB | CC BY-NC-SA | ~15 exercise classes | ⏳ Will audit |
| `hf-motion-rec` | ~1 GB | MIT | Pose + motion | ⏳ Will audit |
| `hf-ucf101-subset` | ~100 MB | CC BY | 101 action classes | ⏳ Will audit |

### 4. Public Datasets (Verified)
| Dataset | License | Exercises | Notes |
|---------|---------|-----------|-------|
| `UCF101` | CC BY 4.0 | 101 classes (subset: push-up, pull-up, squat, etc.) | ✅ Verified available via HF |
| `Penn Action` | Academic | 23 actions | ⏳ Will check mapping |
| `Kinetics-700 subset` | Custom (research) | 70 classes (includes many fitness) | ⏳ Will audit |

## License Verification (DATA_LICENSES.md)
- ExerciseDB GIFs: License TBD - checking https://oss.exercisedb.dev
- UCF101: CC BY 4.0 - ✅ permits training with attribution
- Own recordings: Custom consent forms - ✅ planned
- Kinetics: Custom research license - ⏳ Verifying

## Data Inventory (reports/data_inventory.md)
- Created with counts per source, per-pattern distribution, license status
- Flagged classes with < 30 independent source videos as "weak"

## Next Steps
1. **Record own videos** (B1 blocker) - see ml/RECORDING_PROTOCOL.md
2. **Audit Hugging Face datasets** for license and relevance
3. **Verify ExerciseDB GIF license** - if restricted, use only as reference signatures
4. **Begin keypoint extraction** (Phase 4) once data is collected

## Blocker B1: Record Own Videos
```
Required: ≥3 subjects × ≥5 clips × 8-12 reps each for 20 priority exercises
- Subjects: classmates/volunteers with consent
- Clips: front view + side view per session
- Reps: 8-12 per clip, mixed good-form and partial/bad-form
- Files: {exerciseId}_{subject}_{view}_{good|partial|bad}_{n}.mp4
- Consent: Written consent covering ML training use
- Location: ml/data/raw/own_recordings/
- Do NOT commit videos to git (gitignored)

Action: Human must record and place videos before Phase 4 can proceed meaningfully.
```