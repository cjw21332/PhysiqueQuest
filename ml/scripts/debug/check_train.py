import lance
ds = lance.dataset('hf://datasets/lmms-lab-eval/repcounta-lance/data/train.lance')
meta = ds.to_table(columns=['video_id', 'source_name', 'action_type', 'count']).to_pylist()
print(f'Loaded {len(meta)} videos from HF train dataset')
for row in meta[:15]:
    print(f'  video_id={repr(row["video_id"])} source_name={repr(row["source_name"])} action={repr(row["action_type"])} count={row["count"]}')