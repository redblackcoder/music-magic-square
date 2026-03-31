#!/usr/bin/env python3
"""
Evaluate the trained model on test images.

Place test images in testing/{class}/ folders using the same naming
convention as handwritten/ (e.g., testing/4/, testing/2_plus_4/).

Usage:
    python test_model.py
    python test_model.py --checkpoint checkpoint.pt
    python test_model.py --onnx ../public/cell-recognizer.onnx
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

CLASSES_FILE = os.path.join(SCRIPT_DIR, "classes.json")
TESTING_DIR = os.path.join(SCRIPT_DIR, "testing")
CHECKPOINT_PATH = os.path.join(SCRIPT_DIR, "checkpoint.pt")
ONNX_PATH = os.path.join(PROJECT_DIR, "public", "cell-recognizer.onnx")

with open(CLASSES_FILE) as f:
    class_data = json.load(f)
    CLASSES = class_data["classes"]
    CLASS_INDEX = class_data["index"]

NUM_CLASSES = len(CLASSES)


def load_test_samples(test_dir):
    """Load test images from class-named subdirectories."""
    samples = []
    for dir_name in sorted(os.listdir(test_dir)):
        dir_path = os.path.join(test_dir, dir_name)
        if not os.path.isdir(dir_path):
            continue

        label = dir_name.replace("_plus_", "+")
        if label not in CLASS_INDEX:
            print(f"  Warning: skipping unknown class '{dir_name}'")
            continue

        class_idx = CLASS_INDEX[label]
        for fname in sorted(os.listdir(dir_path)):
            if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                samples.append((os.path.join(dir_path, fname), class_idx, label))

    return samples


def evaluate_pytorch(samples, checkpoint_path, device):
    """Evaluate using PyTorch checkpoint."""
    from train import CellRecognizerCNN

    model = CellRecognizerCNN(NUM_CLASSES).to(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device, weights_only=True))
    model.eval()

    transform = transforms.Compose([
        transforms.Resize((28, 28)),
        transforms.ToTensor(),
    ])

    correct = 0
    total = 0
    per_class = defaultdict(lambda: {"correct": 0, "total": 0})
    errors = []

    with torch.no_grad():
        for path, true_idx, true_label in samples:
            img = Image.open(path).convert("L")
            tensor = transform(img).unsqueeze(0).to(device)
            # Auto-invert if background is light (handwritten = dark on white)
            if tensor.mean() > 0.5:
                tensor = 1.0 - tensor
            output = model(tensor)
            pred_idx = output.argmax(1).item()
            pred_label = CLASSES[pred_idx]

            per_class[true_label]["total"] += 1
            total += 1

            if pred_idx == true_idx:
                correct += 1
                per_class[true_label]["correct"] += 1
            else:
                confidence = torch.softmax(output, dim=1)[0, pred_idx].item()
                errors.append((os.path.basename(path), true_label, pred_label, confidence))

    return correct, total, per_class, errors


def evaluate_onnx(samples, onnx_path):
    """Evaluate using ONNX model."""
    import onnxruntime as ort

    session = ort.InferenceSession(onnx_path)
    input_name = session.get_inputs()[0].name

    transform = transforms.Compose([
        transforms.Resize((28, 28)),
        transforms.ToTensor(),
    ])

    correct = 0
    total = 0
    per_class = defaultdict(lambda: {"correct": 0, "total": 0})
    errors = []

    for path, true_idx, true_label in samples:
        img = Image.open(path).convert("L")
        tensor = transform(img).unsqueeze(0).numpy()
        # Auto-invert if background is light (handwritten = dark on white)
        if tensor.mean() > 0.5:
            tensor = 1.0 - tensor
        output = session.run(None, {input_name: tensor})[0]
        pred_idx = int(np.argmax(output[0]))
        pred_label = CLASSES[pred_idx]

        per_class[true_label]["total"] += 1
        total += 1

        if pred_idx == true_idx:
            correct += 1
            per_class[true_label]["correct"] += 1
        else:
            probs = np.exp(output[0]) / np.exp(output[0]).sum()
            confidence = float(probs[pred_idx])
            errors.append((os.path.basename(path), true_label, pred_label, confidence))

    return correct, total, per_class, errors


def print_results(correct, total, per_class, errors):
    """Print evaluation results."""
    print(f"\n{'=' * 50}")
    print(f"Overall: {correct}/{total} correct ({100 * correct / total:.1f}%)" if total > 0 else "No samples found.")
    print(f"{'=' * 50}")

    if per_class:
        print(f"\n{'Class':<12} {'Correct':<10} {'Total':<8} {'Accuracy':<10}")
        print("-" * 40)
        for label in sorted(per_class.keys()):
            stats = per_class[label]
            acc = 100 * stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            print(f"{label:<12} {stats['correct']:<10} {stats['total']:<8} {acc:.1f}%")

    if errors:
        print(f"\nMisclassifications ({len(errors)}):")
        print(f"{'File':<25} {'Expected':<10} {'Got':<10} {'Confidence':<10}")
        print("-" * 55)
        for fname, expected, got, conf in errors:
            print(f"{fname:<25} {expected:<10} {got:<10} {conf:.3f}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained model on test data")
    parser.add_argument("--checkpoint", type=str, default=CHECKPOINT_PATH, help="PyTorch checkpoint path")
    parser.add_argument("--onnx", type=str, help="Use ONNX model instead of PyTorch checkpoint")
    parser.add_argument("--test-dir", type=str, default=TESTING_DIR, help="Test data directory")
    args = parser.parse_args()

    if not os.path.isdir(args.test_dir):
        print(f"Test directory not found: {args.test_dir}")
        print("Create it and add test images in class subdirectories.")
        sys.exit(1)

    samples = load_test_samples(args.test_dir)
    if not samples:
        print(f"No test images found in {args.test_dir}")
        print("Add images to class subdirectories (e.g., testing/4/, testing/2_plus_4/)")
        sys.exit(1)

    print(f"Found {len(samples)} test images")

    if args.onnx:
        print(f"Evaluating ONNX model: {args.onnx}")
        correct, total, per_class, errors = evaluate_onnx(samples, args.onnx)
    else:
        if not os.path.exists(args.checkpoint):
            print(f"Checkpoint not found: {args.checkpoint}")
            print("Train the model first with: uv run train")
            sys.exit(1)

        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
        print(f"Evaluating PyTorch checkpoint: {args.checkpoint} (device: {device})")
        correct, total, per_class, errors = evaluate_pytorch(samples, args.checkpoint, device)

    print_results(correct, total, per_class, errors)


if __name__ == "__main__":
    main()
