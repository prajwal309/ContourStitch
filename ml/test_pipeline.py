import unittest
import numpy as np
from src.dataset import split_subjects,FEATURES,OUTPUTS
from src.metrics import metrics

class PipelineTests(unittest.TestCase):
    def test_subjects_do_not_leak(self):
        groups=np.repeat([f'p{i}' for i in range(30)],5)
        tr,va,te=split_subjects(groups)
        sets=[set(groups[idx]) for idx in (tr,va,te)]
        self.assertFalse(sets[0]&sets[1]);self.assertFalse(sets[0]&sets[2]);self.assertFalse(sets[1]&sets[2])
        self.assertEqual(len(tr)+len(va)+len(te),len(groups))
    def test_metrics_are_per_measurement(self):
        reference=np.full((3,8),100.0);result=metrics(reference+2,reference)
        self.assertEqual(result['chestCm']['bias'],2);self.assertEqual(result['neckCm']['mae'],2)
        self.assertEqual(result['waistCm']['relativeError'],.02)
    def test_contract(self):
        self.assertEqual(len(FEATURES),12);self.assertEqual(len(OUTPUTS),8)

if __name__=='__main__':unittest.main()
