"""Pipeline smoke data only. This is not an anthropometric dataset."""
import argparse,json
from pathlib import Path
import numpy as np
from src.dataset import FEATURES,OUTPUTS,geometry

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='ml/artifacts/synthetic.jsonl');args=parser.parse_args()
    rng=np.random.default_rng(42)
    x=np.tile([170,.24,.19,.14,.17,.12,.21,.15,.29,.47,.32,.9],(100,1)).astype(np.float32)
    x+=rng.normal(size=x.shape)*np.array([10,.015,.015,.01,.015,.01,.015,.01,.02,.02,.02,.03])
    y=np.zeros((100,8));baseline=geometry(x)
    for i,v in baseline.items():y[:,i]=v
    y[:,4]=x[:,0]*.45;y[:,7]=x[:,0]*.22
    y+=rng.normal(0,1,y.shape)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text('\n'.join(json.dumps({'subjectId':f'synthetic-{i}','synthetic':True,'features':dict(zip(FEATURES,map(float,x[i]))),'referenceCm':dict(zip(OUTPUTS,map(float,y[i])))}) for i in range(100)))
    print('Generated synthetic pipeline data; no accuracy claims are supported.')
