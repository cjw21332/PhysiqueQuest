# RepDB library integration

The app now provides **RepDB guides** as a separate exercise-library source, using the free snapshot at revision `103fef20fe4932f7b40d260329463938477b2f20`: **609 exercises**. Search, equipment/muscle filters, pagination, English instructions and start/peak or main still illustrations are supported. Existing ExerciseDB demos and PhysiqueQuest guides remain separate sources.

## Distribution and attribution

RepDB permits in-app use with visible attribution. Its license restricts republishing the collection or derivatives as a dataset/API; paid preview animations are evaluation-only. See the [publisher's license](https://huggingface.co/datasets/RepDB/exercise-dataset/blob/main/LICENSE.md) and [attribution guidance](https://huggingface.co/datasets/RepDB/exercise-dataset/blob/main/ATTRIBUTION.md).

The implementation prepares an ignored display module at `frontend/.generated/repdb.ts` and bundles it into the application. That module is lazy-loaded when the source is selected. It is not committed, put under public/, offered as a download, or exposed by a new catalog API. No RepDB collection is inserted into MongoDB. Visible RepDB links appear in the list, detail guide and project README.

Only free `images/flat/` paths are accepted. Images load from the pinned publisher revision when details are opened; there is no bulk media download or copied image directory. Illustrations are labeled as still positions, with no fabricated animation controls. Provider instructions are display text; tags claiming injury suitability and MET estimates do not drive medical advice, safety decisions, calorie totals or exercise eligibility.

## Build and development

`npm run prepare:repdb --workspace frontend` fetches the pinned JSON and creates the app display module. The frontend predev/prebuild hooks run it automatically. Subsequent runs reuse the generated file only when the revision and normalization-code hash match. A changed revision or mapper rebuilds it. An unavailable source causes preparation to fail clearly instead of substituting sample records.

Render's existing frontend build invokes the preparation hook; outbound access to Hugging Face is therefore required on a clean build. Backend services and Android JS exports do not import this catalog. The WebView downloads the application chunk when the user opens RepDB guides. Large still-image catalogs are not placed in the initial native bundle.

Do not commit the generated module or upload a standalone dump/API to a public artifact store. Changing the upstream revision requires checking the publisher's current content and terms again. A future server-backed RepDB catalog would require resolving the publisher's API-redistribution restriction first.

## Relation to counting and workout plans

RepDB guides carry manual labels. They are not automatically assigned a counting preset or inserted into saved Coach plans. Users can choose a supported rule explicitly when attaching a video to a planned set. Showing a guide does not establish that the app can recognize or count that exercise.

This snapshot contains text and illustrations, not labeled human repetition videos or pose sequences. It does not provide the held-out motion evidence needed for the trained classifier release gate. No RepDB images were used to train or derive model artwork in this integration. See the [dataset card](https://huggingface.co/datasets/RepDB/exercise-dataset) and [configurable-counter implementation](CONFIGURABLE_COUNTER.md).
