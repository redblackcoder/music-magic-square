#!/usr/bin/env python3
"""
Train a CNN to recognize single digits and digit sums (N+M).

65 classes: 10 single digits (0-9) + 55 sums (N+M where N<=M).
Input: 28x28 grayscale images (white-on-black, MNIST convention).

Usage:
    # Train on synthetic data only:
    python train.py

    # Train on synthetic + handwritten data:
    python train.py --handwritten model-training/handwritten

    # Resume from checkpoint:
    python train.py --resume model-training/checkpoint.pt

    # Export existing checkpoint to ONNX:
    python train.py --export-only model-training/checkpoint.pt

The script:
1. Loads MNIST for transfer learning (pre-trains conv layers on digit recognition)
2. Trains on synthetic data (model-training/synthetic/)
3. Optionally fine-tunes on handwritten data (model-training/handwritten/)
4. Exports to ONNX (public/cell-recognizer.onnx)
"""

import argparse
import json
import os
import sys

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, ConcatDataset
from torchvision import datasets, transforms
from PIL import Image

# ── Config ──

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

CLASSES_FILE = os.path.join(SCRIPT_DIR, "classes.json")
SYNTHETIC_DIR = os.path.join(SCRIPT_DIR, "synthetic")
ONNX_OUTPUT = os.path.join(PROJECT_DIR, "public", "cell-recognizer.onnx")
CHECKPOINT_PATH = os.path.join(SCRIPT_DIR, "checkpoint.pt")

with open(CLASSES_FILE) as f:
    class_data = json.load(f)
    CLASSES = class_data["classes"]
    CLASS_INDEX = class_data["index"]

NUM_CLASSES = len(CLASSES)  # 65


# ── Model ──

class CellRecognizerCNN(nn.Module):
    """
    Small CNN based on MNIST architecture.
    Conv layers are transferable from MNIST pre-training.
    """

    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),
            nn.Conv2d(64, 128, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 7 * 7, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


# ── Dataset ──

class FolderDataset(Dataset):
    """Load images from class-named subdirectories."""

    def __init__(self, root_dir, transform=None):
        self.samples = []
        self.transform = transform

        for dir_name in sorted(os.listdir(root_dir)):
            dir_path = os.path.join(root_dir, dir_name)
            if not os.path.isdir(dir_path):
                continue

            # Map directory name back to class label
            # Directories use "_plus_" instead of "+"
            label = dir_name.replace("_plus_", "+")
            if label not in CLASS_INDEX:
                print(f"  Warning: skipping unknown class directory '{dir_name}'")
                continue

            class_idx = CLASS_INDEX[label]
            for fname in sorted(os.listdir(dir_path)):
                if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                    self.samples.append((os.path.join(dir_path, fname), class_idx))

        print(f"  Loaded {len(self.samples)} images from {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("L")  # Grayscale
        img = img.resize((28, 28), Image.BILINEAR)

        if self.transform:
            img = self.transform(img)
        else:
            img = transforms.ToTensor()(img)

        # Auto-invert if background is light (handwritten = dark on white paper)
        if img.mean() > 0.5:
            img = 1.0 - img

        return img, label


# ── Transfer learning: pre-train on MNIST ──

def pretrain_on_mnist(model, device, epochs=3):
    """Pre-train the conv layers on MNIST digit classification."""
    print("\n── Phase 1: Pre-training conv layers on MNIST ──")

    # Temporarily replace classifier for 10-class MNIST
    orig_classifier = model.classifier
    model.classifier = nn.Sequential(
        nn.Flatten(),
        nn.Linear(128 * 7 * 7, 256),
        nn.ReLU(),
        nn.Dropout(0.5),
        nn.Linear(256, 10),
    ).to(device)

    transform = transforms.Compose([
        transforms.ToTensor(),
    ])

    mnist_train = datasets.MNIST(
        os.path.join(SCRIPT_DIR, "mnist_data"),
        train=True, download=True, transform=transform,
    )
    loader = DataLoader(mnist_train, batch_size=128, shuffle=True, num_workers=0)

    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        correct = 0
        total = 0

        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        acc = 100.0 * correct / total
        print(f"  MNIST epoch {epoch + 1}/{epochs}: loss={total_loss / len(loader):.4f}, acc={acc:.1f}%")

    # Restore the 65-class classifier (conv layers keep MNIST weights)
    model.classifier = orig_classifier.to(device)
    print("  Conv layers pre-trained. Restored 65-class classifier.")


# ── Main training ──

def train(model, train_loader, val_loader, device, epochs=20, lr=1e-3, label=""):
    optimizer = optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()
    best_acc = 0

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        train_acc = 100.0 * correct / total

        # Validation
        val_acc = evaluate(model, val_loader, device) if val_loader else 0

        print(
            f"  {label}epoch {epoch + 1}/{epochs}: "
            f"loss={total_loss / len(train_loader):.4f}, "
            f"train_acc={train_acc:.1f}%, val_acc={val_acc:.1f}%"
        )

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), CHECKPOINT_PATH)

    return best_acc


def evaluate(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)
    return 100.0 * correct / total if total > 0 else 0


def export_onnx(model, device):
    """Export model to ONNX format."""
    model.eval()
    dummy = torch.randn(1, 1, 28, 28).to(device)

    torch.onnx.export(
        model,
        dummy,
        ONNX_OUTPUT,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=18,
    )
    size_kb = os.path.getsize(ONNX_OUTPUT) / 1024
    print(f"\nExported to {ONNX_OUTPUT} ({size_kb:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(description="Train cell recognizer CNN")
    parser.add_argument("--handwritten", type=str, help="Path to handwritten data directory")
    parser.add_argument("--resume", type=str, help="Resume from checkpoint")
    parser.add_argument("--export-only", type=str, help="Export checkpoint to ONNX without training")
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--no-pretrain", action="store_true", help="Skip MNIST pre-training")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Classes: {NUM_CLASSES}")

    model = CellRecognizerCNN(NUM_CLASSES).to(device)

    # Export only mode
    if args.export_only:
        model.load_state_dict(torch.load(args.export_only, map_location=device, weights_only=True))
        export_onnx(model, device)
        return

    # Resume from checkpoint
    if args.resume:
        model.load_state_dict(torch.load(args.resume, map_location=device, weights_only=True))
        print(f"Resumed from {args.resume}")

    # Phase 1: Pre-train on MNIST
    if not args.no_pretrain and not args.resume:
        pretrain_on_mnist(model, device, epochs=3)

    # Phase 2: Train on synthetic data
    print("\n── Phase 2: Training on synthetic data ──")
    augment = transforms.Compose([
        transforms.RandomAffine(degrees=10, translate=(0.1, 0.1), scale=(0.9, 1.1)),
        transforms.ToTensor(),
    ])
    plain = transforms.Compose([transforms.ToTensor()])

    synthetic = FolderDataset(SYNTHETIC_DIR, transform=augment)

    # 90/10 train/val split
    n_val = max(1, len(synthetic) // 10)
    n_train = len(synthetic) - n_val
    train_set, val_set = torch.utils.data.random_split(synthetic, [n_train, n_val])

    train_loader = DataLoader(train_set, batch_size=64, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=64, num_workers=0)

    train(model, train_loader, val_loader, device, epochs=args.epochs, label="Synthetic ")

    # Phase 3: Fine-tune on handwritten data (if provided)
    if args.handwritten and os.path.isdir(args.handwritten):
        hw_dataset = FolderDataset(args.handwritten, transform=augment)
        if len(hw_dataset) > 0:
            print(f"\n── Phase 3: Fine-tuning on handwritten data ──")

            # Oversample handwritten data so it's ~50% of the combined set
            hw_repeats = max(1, len(train_set) // len(hw_dataset))
            hw_oversampled = ConcatDataset([hw_dataset] * hw_repeats)
            combined = ConcatDataset([hw_oversampled, train_set])
            print(f"  Handwritten: {len(hw_dataset)} × {hw_repeats} = {len(hw_oversampled)}, "
                  f"Synthetic: {len(train_set)}, Total: {len(combined)}")
            combined_loader = DataLoader(combined, batch_size=64, shuffle=True, num_workers=0)

            train(model, combined_loader, val_loader, device,
                  epochs=min(15, args.epochs), lr=3e-4, label="Fine-tune ")
        else:
            print(f"\nNo handwritten images found in {args.handwritten}, skipping fine-tune.")

    # Load best checkpoint and export
    if os.path.exists(CHECKPOINT_PATH):
        model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device, weights_only=True))

    export_onnx(model, device)

    # Final evaluation
    val_loader_plain = DataLoader(
        FolderDataset(SYNTHETIC_DIR, transform=plain),
        batch_size=64, num_workers=0,
    )
    final_acc = evaluate(model, val_loader_plain, device)
    print(f"Final accuracy on synthetic data: {final_acc:.1f}%")


if __name__ == "__main__":
    main()
