"""Model definitions for movement pattern classifier."""
from typing import List
import torch
import torch.nn as nn
import torch.nn.functional as F


class CNN1DClassifier(nn.Module):
    """
    1D-CNN for keypoint sequence classification.
    Input: (batch, 48, 132) -> (batch, 132, 48) for Conv1d
    """
    def __init__(
        self,
        input_channels: int = 132,  # 33 joints * 4 (x,y,z,vis)
        num_classes: int = 10,
        channels: List[int] = [128, 128],
        kernel_sizes: List[int] = [5, 5],
        dropout: float = 0.3,
    ):
        super().__init__()
        
        layers = []
        in_ch = input_channels
        for i, (out_ch, k) in enumerate(zip(channels, kernel_sizes)):
            layers.append(nn.Conv1d(in_ch, out_ch, kernel_size=k, padding=k//2))
            layers.append(nn.BatchNorm1d(out_ch))
            layers.append(nn.ReLU(inplace=True))
            if i == len(channels) - 1:
                layers.append(nn.Dropout(dropout))
            in_ch = out_ch
        
        self.conv = nn.Sequential(*layers)
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        self.classifier = nn.Linear(channels[-1], num_classes)
    
    def forward(self, x):
        # x: (batch, seq_len, features) -> (batch, features, seq_len)
        x = x.transpose(1, 2)
        x = self.conv(x)
        x = self.global_pool(x).squeeze(-1)
        x = self.classifier(x)
        return x


class GRUClassifier(nn.Module):
    """
    2-layer GRU for keypoint sequence classification.
    Input: (batch, 48, 132)
    """
    def __init__(
        self,
        input_size: int = 132,
        hidden_size: int = 128,
        num_layers: int = 2,
        num_classes: int = 10,
        dropout: float = 0.3,
        bidirectional: bool = False,
    ):
        super().__init__()
        
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )
        
        gru_out_size = hidden_size * (2 if bidirectional else 1)
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(gru_out_size, num_classes),
        )
    
    def forward(self, x):
        # x: (batch, seq_len, features)
        _, h_n = self.gru(x)
        # h_n: (num_layers * num_directions, batch, hidden_size)
        # Take last layer
        if self.gru.bidirectional:
            h_last = torch.cat([h_n[-2], h_n[-1]], dim=1)
        else:
            h_last = h_n[-1]
        x = self.classifier(h_last)
        return x


def count_parameters(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def export_to_onnx(model, input_shape, output_path, opset_version=13):
    """Export model to ONNX with dynamic batch size."""
    model.eval()
    dummy_input = torch.randn(*input_shape)
    
    dynamic_axes = {
        'input': {0: 'batch_size'},
        'output': {0: 'batch_size'},
    }
    
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes=dynamic_axes,
    )
    
    # Verify
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"Exported to {output_path} (opset {opset_version})")


if __name__ == "__main__":
    # Test models
    cnn = CNN1DClassifier(num_classes=10)
    gru = GRUClassifier(num_classes=10)
    
    print(f"CNN1D params: {count_parameters(cnn):,}")
    print(f"GRU params: {count_parameters(gru):,}")
    
    x = torch.randn(2, 48, 132)
    print(f"CNN out: {cnn(x).shape}")
    print(f"GRU out: {gru(x).shape}")