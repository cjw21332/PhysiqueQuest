# Data Licenses Log (Updated 2026-11-09)

## Sources Under Investigation / Verified

| Source | URL | License | Permits Training? | Permits Redistribution? | Status |
|--------|-----|---------|-------------------|------------------------|--------|
| ExerciseDB GIFs | https://oss.exercisedb.dev/media/{exerciseId}.gif | TBD (check site) | TBD | TBD | ⏳ Downloaded for feature extraction; license review separate |
| PushUpBench | https://huggingface.co/datasets/anonymousatom/pushupbench | CC-BY-4.0 | Yes (with attribution) | Yes | ✅ Verified - can use for training/eval |
| Bench/Deadlift Videos | https://huggingface.co/datasets/Mayank022/bench-press-deadlift-exercises | Other (need verification) | TBD | TBD | ⚠️ License unclear |
| ESK Action Recognition | https://huggingface.co/datasets/amathislab/ESK_action_recognition | CC-BY-4.0 | Yes (with attribution) | Yes | ✅ Verified - kitchen actions, some exercise-like |
| RepCount-A (Lance) | https://huggingface.co/datasets/lmms-lab-eval/repcounta-lance | Other (need verification) | TBD | TBD | ⚠️ License unclear |
| Penn Action (Test Subset) | https://huggingface.co/datasets/urzsi/Penn-Action-Lossless-MKV-Test-Subset | Unknown | TBD | TBD | ⚠️ License unclear |
| MPII Human Pose | https://huggingface.co/datasets/Voxel51/MPII_Human_Pose_Dataset | BSD-2-Clause | Yes | Yes | ✅ Verified - IMAGES only, not video |
| UCF101 | https://www.crcv.ucf.edu/data/UCF101.php | **Research use only** (NOT CC BY 4.0) | Research only | No commercial | ⚠️ Official: "non-commercial research use" |
| Kinetics-700 | DeepMind | Custom (research) | Research only | With attribution | ⚠️ Custom license, non-commercial |
| QEVD / QEVD-FIT-COACH | Qualcomm / Hugging Face | TBD | TBD | TBD | ⏳ Not pursued (gated) |
| Fit3D | Stanford / authors | Likely academic/research | TBD | TBD | ⏳ Skipped (not critical) |
| Own recordings | Self-collected | Custom (our terms) | Yes | Yes (with consent) | ⏳ Pending (B1 blocker) |

## License Verification Notes
- **UCF101**: Official UCF site says "non-commercial research use only" - NOT CC BY 4.0 as previously claimed. Removed incorrect claim.
- **Kinetics-700**: Custom DeepMind license for non-commercial research use.
- **PushUpBench**: CC-BY-4.0 - explicitly permits training and redistribution with attribution.
- **ESK Action Recognition**: CC-BY-4.0 - permits training with attribution.
- **ExerciseDB GIFs**: Downloaded for feature extraction pipeline; license review ongoing separately; NOT used as training data until verified.
- **MPII**: Images only (25K), BSD-2-Clause - good for pose estimation but not action video.
- **All used datasets**: Must include attribution in any derived work.

## Decision Log
- Will NOT use any dataset that forbids training or redistribution of derived weights.
- ExerciseDB GIFs used ONLY for: reference signatures, movement pattern mapping, keypoint extraction benchmark; NOT for training classifier weights.
- PushUpBench, ESK: Can use for training/eval with attribution.
- UCF101, Kinetics: Research use only; cannot redistribute model weights trained on them commercially.
- Own recordings will have explicit consent forms covering ML training use.
- Model artifacts will include license manifest.

## Previously Downloaded
- ExerciseDB catalog: 1500 exercises (ml/data/exercisedb_catalog.json)
- ExerciseDB ML mapping: exercise_ml_map.json (ml/data/exercise_ml_map.json)
- Mapping review: mapping_review.csv (ml/reports/mapping_review.csv)
- Coverage report: mapping_coverage.md (ml/reports/mapping_coverage.md)
- HF candidates full list: hf_candidates.json / hf_candidates.md (ml/reports/)
- HF key findings: hf_key_findings.json (ml/reports/)

## Next Steps for Real Video Data
1. **PushUpBench** (CC-BY-4.0): ~653 downloads, push-up video rep counting benchmark. Download and extract.
2. **ESK Action Recognition** (CC-BY-4.0): Kitchen actions, some transferable motion patterns. Download and filter.
3. **RepCount-A**: Need to find original source (paper repo) for license verification.
4. **Own recordings (B1)**: Developer records phone clips for 6 starter exercises - this is the gold standard test set.