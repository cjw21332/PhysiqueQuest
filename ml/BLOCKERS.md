# Blockers (Active - but continuing autonomously)

| ID | Description | Impact | Resolution Status |
|----|-------------|--------|-------------------|
| B1 | Own recorded videos (≥3 subjects × ≥5 clips × 20 exercises) | Cannot validate on real phone data; all metrics marked "public/GIF only" | ⏳ Continuing with synthetic/public data; real device test later |
| B2 | Physical Android/iOS device for on-device inference testing | Cannot verify G10/G11 on real hardware; Path A (WebWorker) used instead | ⏳ Continuing with WebWorker; native test later |
| B3 | ExerciseDB GIF license verification | If restricted, GIFs can only be reference signatures; proceeding with download for feature extraction only | ⏳ Downloading; license review separate |
| B4 | Fit3D dataset access | Gated; not critical path | ⏳ Skipped |
| B5 | Hugging Face gated datasets | May need access requests; candidates audited in hf_candidates.md | ⏳ Audited; proceeding with public datasets only |

## Notes
- All metrics validated on public/GIF data only until real recordings arrive
- No exercises marked `verified` until real-device gate G11 passes
- STATUS_REPORT.md (not FINAL_REPORT.md) until all gates pass
- Committing after each phase as instructed