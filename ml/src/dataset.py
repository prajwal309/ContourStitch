import json
from pathlib import Path
import numpy as np
from sklearn.model_selection import GroupShuffleSplit

CONTRACT = json.loads((Path(__file__).parent / 'features.json').read_text())
FEATURES = CONTRACT['featureNames']
OUTPUTS = CONTRACT['outputNames']

def load_records(path):
    records = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    x = np.asarray([[r['features'][name] for name in FEATURES] for r in records], dtype=np.float32)
    y = np.asarray([[r['referenceCm'][name] for name in OUTPUTS] for r in records], dtype=np.float32)
    groups = np.asarray([r['subjectId'] for r in records])
    if len(set(groups)) < 10 or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Need at least ten subjects and complete finite features/references')
    return x, y, groups, all(r.get('synthetic') is True for r in records)

def split_subjects(groups, seed=42):
    indices = np.arange(len(groups))
    train_val, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=seed).split(indices, groups=groups))
    train, val = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=seed).split(train_val, groups=groups[train_val]))
    return train_val[train], train_val[val], test

def geometry(x):
    h=x[:, 0]
    def circumference(front, side):
        a=x[:, front]*h/2; b=x[:, side]*h/2
        return np.pi*(3*(a+b)-np.sqrt((3*a+b)*(a+3*b)))
    # Inseam/neck are unavailable from the browser's current feature set.
    return {0:circumference(2,3),1:circumference(4,5),2:circumference(6,7),3:x[:,1]*h,5:x[:,10]*h,6:x[:,8]*h}
