import numpy as np
from .dataset import OUTPUTS

def metrics(predicted, reference):
    error=np.asarray(predicted)-np.asarray(reference)
    absolute=np.abs(error)
    return {name:{'bias':float(error[:,i].mean()),'mae':float(absolute[:,i].mean()),'rmse':float(np.sqrt((error[:,i]**2).mean())),'medianAbsoluteError':float(np.median(absolute[:,i])),'p95AbsoluteError':float(np.percentile(absolute[:,i],95)),'relativeError':float((absolute[:,i]/np.maximum(np.abs(reference[:,i]),1e-6)).mean())} for i,name in enumerate(OUTPUTS)}
