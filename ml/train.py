import argparse,copy,json,random
from pathlib import Path
import numpy as np
import torch
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from src.dataset import load_records,split_subjects,FEATURES,OUTPUTS,geometry
from src.model import MeasurementMLP
from src.metrics import metrics

def train(data,output,epochs):
    random.seed(42);np.random.seed(42);torch.manual_seed(42);torch.set_num_threads(1)
    x,y,groups,synthetic=load_records(data);tr,va,te=split_subjects(groups)
    mean=x[tr].mean(0);std=np.maximum(x[tr].std(0),1e-6);ym=y[tr].mean(0);ys=np.maximum(y[tr].std(0),1e-6)
    xn=(x-mean)/std;yn=(y-ym)/ys
    model=MeasurementMLP();optimizer=torch.optim.Adam(model.parameters(),lr=.001);loss=torch.nn.HuberLoss()
    best=float('inf');weights=copy.deepcopy(model.state_dict());stale=0
    for _ in range(epochs):
        model.train();optimizer.zero_grad();value=loss(model(torch.from_numpy(xn[tr])),torch.from_numpy(yn[tr]));value.backward();optimizer.step()
        model.eval()
        with torch.no_grad():validation=float(loss(model(torch.from_numpy(xn[va])),torch.from_numpy(yn[va])))
        if validation<best-1e-5:best=validation;weights=copy.deepcopy(model.state_dict());stale=0
        else:stale+=1
        if stale>=30:break
    model.load_state_dict(weights);model.eval()
    with torch.no_grad():prediction=model(torch.from_numpy(xn[te])).numpy()*ys+ym
    comparisons={'mlp':metrics(prediction,y[te])}
    for name,baseline in [('linear',Ridge()),('randomForest',RandomForestRegressor(n_estimators=100,random_state=42))]:
        baseline.fit(xn[tr],y[tr]);comparisons[name]=metrics(baseline.predict(xn[te]),y[te])
    geom=geometry(x[te]);comparisons['geometry']={OUTPUTS[i]:metrics(np.tile(v[:,None],(1,8)),np.tile(y[te,i,None],(1,8)))[OUTPUTS[i]] for i,v in geom.items()}
    out=Path(output);out.mkdir(parents=True,exist_ok=True)
    torch.save(weights,out/'weights.pt')
    (out/'preprocessing.json').write_text(json.dumps({'mean':mean.tolist(),'std':std.tolist(),'targetMean':ym.tolist(),'targetStd':ys.tolist()},indent=2))
    (out/'model-metadata.json').write_text(json.dumps({'version':'experimental-1','featureNames':FEATURES,'outputNames':OUTPUTS,'outputUnits':'cm','requiredCalibrationInputs':['heightCm'],'trainingData':'synthetic' if synthetic else 'real','validated':False},indent=2))
    (out/'evaluation.json').write_text(json.dumps({'synthetic':synthetic,'metrics':comparisons,'subjects':{k:sorted(set(groups[idx])) for k,idx in [('train',tr),('validation',va),('test',te)]}},indent=2))
    np.savez(out/'test.npz',x=x[te],y=y[te])
    print('Saved model and held-out evaluation. Synthetic results are pipeline checks only.' if synthetic else 'Saved model; independent real-subject validation is still required.')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--output',default='ml/artifacts');p.add_argument('--epochs',type=int,default=500);a=p.parse_args();train(a.data,a.output,a.epochs)
