# Free Cloud GPU Options for ML Training (2025-2026)

This document provides a comprehensive overview of free cloud GPU options for machine learning training and inference.

## Top Free GPU Platforms

### 1. Kaggle Notebooks ⭐ **Best Overall**
- **GPU**: NVIDIA Tesla P100 (16GB) or 2x T4 (32GB combined)
- **Free Hours**: 30 hours/week GPU quota
- **Session Limit**: Up to 12 hours per session
- **Storage**: 73GB persistent storage
- **RAM**: 29GB (recently upgraded from 13GB)
- **CPU**: 4 cores (recently upgraded from 2)
- **TPU**: TPU v5e-8 available (20 hours/week)
- **Credit Card**: Not required
- **Best For**: Training, competitions, dataset work
- **Limitations**: No internet access during GPU sessions, requires phone verification

### 2. Google Colab ⭐ **Most Popular**
- **GPU**: NVIDIA T4 (16GB VRAM)
- **Free Hours**: ~15-30 GPU-hours/week (unpublished, varies with demand)
- **Session Limit**: ~12 hours max, ~90 min idle timeout
- **Storage**: Ephemeral (use Google Drive for persistence)
- **RAM**: ~12.7GB
- **Credit Card**: Not required
- **Best For**: Quick experiments, notebooks, prototyping
- **Limitations**: Random disconnections, no persistent storage, no background execution on free tier

### 3. Lightning AI Studios ⭐ **Most Professional**
- **GPU**: T4, L4, A10G, up to H200 (141GB)
- **Free Hours**: 15 credits/month (~22 GPU-hours on T4)
- **Session Limit**: 4-hour studio restart requirement
- **Storage**: 50GB persistent
- **Features**: Full VS Code IDE, terminal access, SSH
- **Credit Card**: Not required
- **Best For**: Full development environment, PyTorch Lightning workflows
- **Limitations**: Credit system can be confusing, credits expire monthly

### 4. Saturn Cloud
- **GPU**: NVIDIA T4-class (16GB)
- **Free Hours**: ~30 hours/month (unpublished)
- **Best For**: Dask + GPU workflows
- **Credit Card**: Required for some tiers
- **Limitations**: Limited to specific frameworks

### 5. Paperspace Gradient (DigitalOcean)
- **GPU**: NVIDIA M4000 (8GB)
- **Free Hours**: 6-hour sessions, unlimited restarts
- **Session Limit**: 12-hour auto-shutdown
- **Storage**: 5GB
- **Credit Card**: Not required for free tier
- **Best For**: Learning PyTorch/TensorFlow
- **Limitations**: Free-tier notebooks are public, queue times can be long

### 6. Hugging Face ZeroGPU
- **GPU**: RTX Pro 6000 Blackwell (48-96GB)
- **Free Hours**: Community GPU grants
- **Best For**: Model demos, inference
- **Limitations**: Must apply for GPU access

### 7. Intel Tiber AI Cloud
- **GPU**: Intel Gaudi or Intel Max (48GB)
- **Free Hours**: 120-day trial
- **Best For**: Intel-optimized models
- **Credit Card**: Not required

## Comparison Table

| Platform | GPU | VRAM | Free Hours | Session | Storage | Best For |
|----------|-----|------|------------|---------|---------|----------|
| **Kaggle** | P100 / 2x T4 | 16GB / 32GB | 30 hrs/week | 12h | 73GB | Training & competitions |
| **Google Colab** | T4 | 16GB | ~15-30 hrs/week | ~12h | Ephemeral | Quick experiments |
| **Lightning AI** | T4 - H200 | 16GB - 141GB | ~22 hrs/month | 4h restart | 50GB | Full dev environment |
| **Saturn Cloud** | T4-class | 16GB | ~30 hrs/month | - | - | Dask + ML workflows |
| **Paperspace** | M4000 | 8GB | 6 hrs/session | 12h | 5GB | Learning PyTorch/TF |
| **HF ZeroGPU** | RTX 6000 | 48-96GB | Community grants | - | - | Model demos |
| **Intel Tiber** | Gaudi/Max | 48GB | 120-day trial | - | - | Intel models |

## Recommended Usage Strategies

### For Training Small Models (DistilBERT, ViT-Small)
- **Time**: 15-30 minutes on T4
- **Platform**: Kaggle or Colab
- **Tips**: Use mixed precision (fp16) to halve memory usage

### For Fine-tuning 7B Models (LoRA/QLoRA)
- **Time**: 1-2 hours on T4
- **Platform**: Kaggle (30GB VRAM with dual T4) or Lightning AI
- **Tips**: Use gradient accumulation for larger effective batch sizes

### For Inference & RAG Demos
- **Recommendation**: Use local inference (Ollama) instead of cloud GPUs
- **Reason**: No queue, no idle-kick, no quota anxiety

### For Long Training Runs
- **Platform**: Kaggle (predictable 30h/week quota)
- **Alternative**: Paid spot instances ($0.10-0.30/hr on AWS/GCP)

## Optimization Tips

1. **Use fp16/mixed precision** - Halves memory usage, doubles training speed
2. **Gradient accumulation** - Simulate larger batch sizes without more VRAM
3. **Save checkpoints frequently** - Sessions can disconnect unexpectedly
4. **Use Kaggle over Colab for training** - More predictable quota, no random disconnects
5. **Mount persistent storage** - Google Drive for Colab, built-in for Kaggle
6. **Monitor your quota** - Most platforms have weekly/monthly limits

## When to Move to Paid Options

Consider upgrading to paid GPU instances when:
- You need more than 30 GPU hours per week consistently
- You require uninterrupted training sessions (>12 hours)
- You need specific GPU models (A100, H100, etc.)
- You need SSH access and full environment control
- You're running production workloads

## Cost-Effective Paid Alternatives

If you outgrow free tiers, consider these budget-friendly options:

- **Vast.ai**: $0.10-1.00/hr (P2P GPU marketplace)
- **RunPod**: $0.20-2.00/hr (3090, A100 available)
- **AWS/GCP Spot Instances**: $0.10-2.50/hr (preemptible but cheap)
- **Thunder Compute**: $0.35-2.19/hr (dedicated GPUs)

## Integration with MLverse

The MLverse platform already supports:
- **Google Colab export** via the Colab Execution Response
- **Notebook generation** with GPU checks (`torch.cuda.is_available()`)
- **Training code export** ready for cloud GPU execution

Use the "Export to Colab" feature in the ResultsDrawer to seamlessly move your trained models to free GPU platforms for further training or deployment.

---

*Last updated: August 2025*
