import argparse,json
from pathlib import Path
import numpy as np
import torch
from src.model import MeasurementMLP
from src.metrics import metrics
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',default='ml/artifacts');args=parser.parse_args();source=Path(args.source)
    p=json.loads((source/'preprocessing.json').read_text());data=np.load(source/'test.npz');model=MeasurementMLP();model.load_state_dict(torch.load(source/'weights.pt',weights_only=True,map_location='cpu'));model.eval()
    with torch.no_grad():prediction=model(torch.tensor((data['x']-p['mean'])/p['std'],dtype=torch.float32)).numpy()*p['targetStd']+p['targetMean']
    print(json.dumps(metrics(prediction,data['y']),indent=2))
