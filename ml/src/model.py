from torch import nn

class MeasurementMLP(nn.Module):
    def __init__(self, inputs=12, outputs=8):
        super().__init__()
        self.network = nn.Sequential(nn.Linear(inputs, 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, outputs))

    def forward(self, features):
        return self.network(features)
