import argparse,json,shutil,inspect
from pathlib import Path
import numpy as np
import torch
import onnxruntime as ort
from src.model import MeasurementMLP

def export(source,destination):
    source=Path(source);destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    model=MeasurementMLP();model.load_state_dict(torch.load(source/'weights.pt',map_location='cpu',weights_only=True));model.eval()
    sample=torch.randn(4,12);path=destination/'contourstitch-video-measurement.onnx'
    torch.onnx.export(model,sample,str(path),input_names=['features'],output_names=['measurements'],dynamic_axes={'features':{0:'batch'},'measurements':{0:'batch'}},opset_version=17,**({'dynamo':False} if 'dynamo' in inspect.signature(torch.onnx.export).parameters else {}))
    session=ort.InferenceSession(str(path),providers=['CPUExecutionProvider'])
    with torch.no_grad():expected=model(sample).numpy()
    np.testing.assert_allclose(session.run(None,{'features':sample.numpy()})[0],expected,rtol=1e-4,atol=1e-5)
    p=json.loads((source/'preprocessing.json').read_text());test=np.load(source/'test.npz')['x'];normalized=((test-np.array(p['mean']))/np.array(p['std'])).astype(np.float32)
    with torch.no_grad():expected=model(torch.from_numpy(normalized)).numpy()
    np.testing.assert_allclose(session.run(None,{'features':normalized})[0],expected,rtol=1e-4,atol=1e-5)
    for name in ['preprocessing.json','model-metadata.json']:shutil.copyfile(source/name,destination/name)
    print('ONNX export passed PyTorch equivalence on random and held-out inputs.')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',default='ml/artifacts');p.add_argument('--destination',default='public/models');a=p.parse_args();export(a.source,a.destination)
