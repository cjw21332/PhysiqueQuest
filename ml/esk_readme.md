---
language:
- en
license: cc-by-4.0
size_categories:
- 10K<n<100K
tags:
- behavior
- motion
- human
- egocentric
- exocentric
- 3d_pose
- hand_pose
- body_pose
- language
- esk
- action_recognition
- classification
pretty_name: ESK-ActionRec
---

[Paper](https://arxiv.org/abs/2506.01608) | [GitHub](https://github.com/amathislab/EPFL-Smart-Kitchen)

# 🍳 EPFL-Smart-Kitchen: Action recognition benchmark

## 📚 Introduction
Given a video or temporal clip, action recognition requires the model to predict a single action label for that clip (or for a specified window within an untrimmed video). Building on the same EPFL-Smart-Kitchen-30 data and modalities as our segmentation benchmark, we provide a recognition-oriented setup to compare inputs from 3D body pose, hand pose, and eye gaze, as well as deep visual features (e.g., VideoMAE).

Action recognition with kinematic inputs is lightweight and fast, while still capturing rich information about the task. We therefore offer recognition-ready annotations and splits that pair these modalities with clip-level labels. This makes it easy to evaluate the effect of different inputs (body vs hand vs gaze vs video) on standard classification metrics.


## 📋 Content
This repository contains materials for performing action recognition on EPFL-Smart-Kitchen-30. You can find the original dataset on [Zenodo](https://zenodo.org/records/15535461).

Current contents in this folder:
```
ESK_action_recognition
├── benchmark_data.z01
├── benchmark_data.z02
├── benchmark_data.z03
├── benchmark_data.z04
├── benchmark_data.z05
├── benchmark_data.z06
├── benchmark_data.zip            # main part (open this to extract)
├── checkpoints.z01
├── checkpoints.z02
├── checkpoints.z03
├── checkpoints.z04
├── checkpoints.z05
├── checkpoints.zip               # main part (open this to extract)
└── README.md
```

How to unzip (Linux):

1) Ensure all parts are in the same directory (as above).
2) Use either unzip or 7-Zip, starting from the `.zip` file (not the `.z01`).

- With unzip (preinstalled on many systems):
```bash
unzip benchmark_data.zip
unzip checkpoints.zip
```

- With 7-Zip (if you prefer):
```bash
# install if needed (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y p7zip-full

7z x benchmark_data.zip
7z x checkpoints.zip
```

Notes:
- Don’t try to extract the `.z01` files directly—always open the corresponding `.zip` file.
- If extraction fails, verify that all parts are fully downloaded and present.

After extracting the files, you will get the following folders:
```
ESK_action_recognition
├── Benchmark_data
|   ├── [PARTICIPANT_ID]/[SESSION_ID]
├── Annotations
|   ├── [SPLIT].csv
├── Hand_videos
|   ├── [SPLIT]
├── pose_data
|   ├── [PARTICIPANT_ID]/[SESSION_ID]
├── checkpoints
|   ├── [INPUT_TYPE]_experiment
|   ├── [INPUT_TYPE]_nopretrain_experiment
└── README.md
```

## 📊 Data format
Clip-level labels are provided in CSV form for straightforward use with classification training code. A minimal `activity_labels.csv` contains the following columns:

- `clip_id`: Unique identifier for the clip
- `participant_id`: e.g., YH20XX
- `session_id`: e.g., YYYY_MM_DD_hh_mm_ss
- `start_frame`, `end_frame`: temporal window within the session (omit if clips are pre-trimmed files)
- `label_id`: integer-coded action class
- `label_name`: human-readable action name

Splits are text/CSV files listing `clip_id` or clip paths for train/val/test.


## 🌈 Usage
Training and evaluation code are available on the [GitHub repository](https://github.com/amathislab/EPFL-Smart-Kitchen). Please see the Action Recognition section for:

- dataset splits and loading utilities for clip-level labels
- using 3D kinematic features (body/hand/eyes) and/or VideoMAE features
- training scripts for classification models (e.g., MLP/Transformer over features)


## 🌟 Citations

Please cite our work!
```
@misc{bonnetto2025epflsmartkitchen,
      title={EPFL-Smart-Kitchen-30: Densely annotated cooking dataset with 3D kinematics to challenge video and language models}, 
      author={Andy Bonnetto and Haozhe Qi and Franklin Leong and Matea Tashkovska and Mahdi Rad and Solaiman Shokur and Friedhelm Hummel and Silvestro Micera and Marc Pollefeys and Alexander Mathis},
      year={2025},
      eprint={2506.01608},
      archivePrefix={arXiv},
      primaryClass={cs.CV},
      url={https://arxiv.org/abs/2506.01608}, 
}
```

❤️ Acknowledgments
Our work was funded by EPFL, Swiss SNF grant (320030-227871), Microsoft Swiss Joint Research Center and a Boehringer Ingelheim Fonds PhD stipend (H.Q.). We are grateful to the Brain Mind Institute for providing funds for hardware and to the Neuro-X Institute for providing funds for services.
