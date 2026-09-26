# GraphFlow-AI

> **Interactive Deep Learning Architecture Designer & Hardware Infrastructure Simulator**  
> *Design, validate, profile, and scale frontier transformer, MoE, and recurrent neural network architectures up to 1T parameters before writing a single line of training code.*

---

## 🌟 Executive Overview

Modern frontier deep learning requires navigating a complex trade-off space between architectural decisions (context length, hidden dimension, head configurations, expert counts) and physical hardware constraints (GPU memory capacity, HBM bandwidth, interconnect latencies, pipeline bubbles, and tensor parallelism).

Traditionally, engineers and researchers design architectures across fragmented tools: sketching diagrams in general-purpose drawing tools (e.g. Draw.io, Excalidraw), estimating parameters in ad-hoc Python notebooks or spreadsheets, and discovering memory-bandwidth bottlenecks or tensor dimension mismatches only after allocating multi-million-dollar compute clusters.

**GraphFlow-AI** bridges this gap by unifying:
1. **Interactive Hierarchical Canvas:** Visual node-based computational graph builder with block repetition grouping, residual skip-stream routing, and real-time vertical diagram spacing.
2. **Tensor Shape Verification Engine:** Automatic contract validation across layers with dimension mismatch simulation and diagnosis.
3. **Hardware & Roofline Profiler:** Real-time operational roofline curves, memory breakdown (Weights, KV Cache, Activations, Optimizer states across FP32, BF16, INT8, FP4), and hardware cluster profiles (NVIDIA H100 SXM, B200, A100, TPU v5p, L40S).
4. **Distributed 3D Parallelism Simulator:** Quantitative modeling of Tensor Parallelism (TP), Pipeline Parallelism (PP) with 1F1B bubble ratios, and ZeRO-1/2/3 data parallel states over NVLink and InfiniBand.
5. **Code & Spec Generation:** Clean PyTorch `nn.Module` export and reproducible JSON specifications.

---

## 🔍 Landscape Analysis & Competitive Comparison

While various specialized tools exist in the machine learning ecosystem, they typically focus on either **post-hoc inspection** (after a model is trained or compiled) or **isolated static math calculators** (spreadsheets/scripts with no visual canvas). 

Below is an in-depth comparison of existing online solutions and tools relative to GraphFlow-AI:

### Feature Comparison Matrix

| Feature / Capability | **GraphFlow-AI** | **Netron** | **LLM-Viewer / Online Calculators** | **DeepSpeed / Megatron CLI Calculators** | **NN-SVG / LeNet Visualizers** | **Torchview / Torchviz** | **Weights & Biases / TensorBoard** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Primary Paradigm** | Pre-training Architectural Design & Infrastructure Simulator | Post-training Checkpoint / Graph Inspection | Static Analytical LLM Sizing Calculators | Script-based Parallelism Planning | Static Publication Diagram Generation | Python Execution Graph Dump | Runtime Telemetry & Experiment Tracking |
| **Interactive Drag & Drop Canvas** | ✅ **Full interactive React Flow canvas** | ❌ Read-only inspection | ❌ Form / table inputs only | ❌ CLI / script only | ❌ Parameter sliders only | ❌ Static image export | ❌ Dashboard charts only |
| **Block Repetition Grouping ($N\times$ Layers)** | ✅ **Native with collapsible & expansion hierarchy** | ❌ Flat or fixed subgraphs | ❌ Abstract $L$ scalar multiplier | ❌ Abstract $L$ scalar multiplier | ❌ Repetition not grouped hierarchically | ❌ Unrolled flat execution trace | ❌ N/A (Telemetry) |
| **Residual Skip Edge Clearance & Routing** | ✅ **Dynamic with guarantee $\ge$ text badge height & stretch slider** | ❌ Automatic fixed dagre layout | ❌ N/A | ❌ N/A | ❌ Fixed 2D/3D vectors | ❌ Automatic Graphviz routing | ❌ N/A |
| **Tensor Dimension Contract Verification** | ✅ **Real-time edge contract checking & mismatch flags** | ⚠️ Checks pre-compiled shapes | ❌ No block-level flow validation | ❌ No graph verification | ❌ Aesthetic only | ⚠️ Validates at Python runtime | ❌ N/A |
| **Speculative Architecture Design (Up to 1T params)** | ✅ **Built-in presets (Llama-3, GPT-4, MoE, DeepSeek, Mamba)** | ❌ Requires pre-existing checkpoint | ⚠️ Limited to pre-configured catalog | ⚠️ Requires custom script edits | ❌ Toy models only (MLP/CNN) | ❌ Requires instantiating model in RAM | ❌ N/A |
| **Dynamic Operational Roofline Model** | ✅ **Real-time FLOPs/byte vs. TFLOPs across GPU chips** | ❌ No | ⚠️ Static arithmetic intensity table | ❌ No visual roofline plot | ❌ No | ❌ No | ⚠️ Requires hardware profiler (Nsight) |
| **Granular Memory Decomposition** | ✅ **Weights + KV Cache + Activations + Optimizer across FP32-FP4** | ❌ Parameter size only | ⚠️ KV Cache & Weight sizing | ✅ ZeRO memory estimation | ❌ No | ❌ Peak memory trace only | ⚠️ Post-facto observed GPU VRAM |
| **Distributed 3D Parallelism Simulation** | ✅ **TP, PP (Bubble ratio), DP (ZeRO-1/2/3), NVLink/InfiniBand** | ❌ No | ⚠️ Partial (TP/PP batch sizing) | ✅ Megatron / DeepSpeed math | ❌ No | ❌ No | ⚠️ Post-facto training run logs |
| **PyTorch `nn.Module` Code Generator** | ✅ **Generates valid, modular PyTorch code** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ Reads Python code, does not emit it | ❌ No |
| **Shareable & Exportable Specs** | ✅ **JSON import/export, URL state, PyTorch script** | ⚠️ Reads ONNX/PT files | ⚠️ URL parameters (some) | ❌ Config scripts | ⚠️ SVG/PNG export only | ⚠️ PNG/PDF only | ✅ Shared dashboard links |

---

## 🔬 Detailed Breakdown of Existing Solutions

### 1. [Netron](https://github.com/lutzroeder/netron)
* **What it does well:** Netron is the gold standard for inspecting existing, already-built model checkpoints (`.onnx`, `.pt`, `.tflite`, `.safetensors`, `.savedmodel`). It lets developers inspect tensor names, shapes, and layer attributes of exported weights.
* **Why it differs from GraphFlow-AI:** Netron is strictly **read-only and post-hoc**. You cannot design a new speculative model from scratch, edit blocks, evaluate what-if hardware rooflines, simulate distributed communication bottlenecks, or calculate multi-node GPU memory requirements before weights are generated.

### 2. LLM-Viewer / Online LLM Calculators (e.g. llm-viewer.com, TensorRT-LLM Calculators)
* **What it does well:** Excellent web calculators for computing memory footprints, prefill vs. decode latency, and KV cache sizing for known LLMs (e.g. Llama-2-70B, Mistral-7B) on fixed GPU SKUs.
* **Why it differs from GraphFlow-AI:** These tools are form-based calculators without a visual computational canvas. They cannot represent custom block sequences, hybrid architectures (such as Transformer + SSM / Mamba or custom MoE routers), skip connections, or structural tensor contract validations.

### 3. DeepSpeed / Megatron-LM Estimation Scripts
* **What it does well:** Highly accurate mathematical formulas for estimating 3D parallelism memory (ZeRO-1/2/3, Tensor Parallelism, Pipeline Parallelism) and inter-node communication overhead.
* **Why it differs from GraphFlow-AI:** These are command-line scripts or Python formulas without an interactive graphical interface, visual roofline charts, real-time diagram rendering, or code generation.

### 4. NN-SVG & Scientific Diagram Generators
* **What it does well:** Generates aesthetic 2D and 3D schematic figures (classic LeNet/AlexNet/MLP layers) suitable for academic research papers.
* **Why it differs from GraphFlow-AI:** Purely aesthetic illustration tools. They do not calculate FLOPs, memory bandwidth, activation sizes, or distributed communication latency.

### 5. Torchview / Torchviz
* **What it does well:** Introspects existing Python PyTorch models by running a dummy forward pass through `torch.autograd` or `torch.fx` and exporting a Graphviz graph.
* **Why it differs from GraphFlow-AI:** Requires that the model already compiles and can be instantiated in memory. For speculative trillion-parameter models, instantiating the model locally is impossible. GraphFlow-AI works parametrically without requiring multi-GPU hardware.

---

## 🏗 Key Innovations in GraphFlow-AI

1. **Dual Architectural & Physical Co-Design:** Rather than designing a model in isolation from the hardware cluster, GraphFlow-AI evaluates your model against specific physical hardware (e.g. 8× H100 SXM5 80GB, 512× B200 192GB, TPU v5p) in real time.
2. **Dynamic Operational Roofline:** Instantly reveals whether each individual block and the overall model is **Memory-Bandwidth Bound** (e.g. Decode Attention, SwiGLU, RMSNorm) or **Compute Bound** (e.g. Prefill GEMMs, MLP projections).
3. **Hierarchical Repetition Groups with Clear Skip Connections:** Visually abstracts $L=80$ repeated decoder blocks without overwhelming the canvas, while preserving explicit residual skip connections with guaranteed vertical clearance ($\ge 32\text{px}$) and user-controlled diagram stretching.
4. **Interactive Mismatch Diagnostics:** Highlights tensor shape mismatches along edges with explanations and recommended fixes.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
git clone <repository-url>
cd graphflow-ai
npm install
```

### Development
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Production Build
```bash
npm run build
```

---

## 📚 Recommended Reading & Conceptual Foundations

For researchers, systems engineers, and students wanting to master the core principles behind the **Operational Roofline Model** and **Distributed Cluster Topology Analysis** implemented in GraphFlow-AI, here is a curated roadmap of foundational papers, textbook chapters, and industry guides:

### 1. Roofline Model & Hardware Arithmetic Intensity
* **The Seminal Paper:**
  * Williams, S., Waterman, A., & Patterson, D. (2009). *“Roofline: An Insightful Visual Performance Model for Multicore Architectures.”* Communications of the ACM, 52(4), 65–76. [[ACM Link](https://dl.acm.org/doi/10.1145/1498765.1498785)]
  * *Why read it:* Introduces the fundamental relationship between arithmetic intensity ($\text{FLOPs}/\text{Byte}$), memory bandwidth ceilings, and peak computational ceilings.
* **GPU & Deep Learning Operational Roofline:**
  * Dao, T., et al. (2022). *“FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness.”* NeurIPS 2022. [[arXiv:2205.14135](https://arxiv.org/abs/2205.14135)]
  * *Why read it:* Explains why naive attention is memory-bandwidth bound due to $O(N^2)$ HBM read/writes, and how tiling across SRAM dramatically increases arithmetic intensity.
  * Horace He (2022). *“Making Deep Learning Go Brrrr From First Principles.”* [[Blog Post](https://horace.io/brrr_intro.html)]
  * *Why read it:* The most intuitive, practitioner-friendly explanation of compute vs. memory-bandwidth bound operations, kernel fusion, and Tensor Core utilization.
  * NVIDIA Documentation: *“Kernel Profiling with NVIDIA Nsight Compute & Roofline Analysis.”* [[NVIDIA Docs](https://docs.nvidia.com/nsight-compute/)]

### 2. Distributed Parallelism Topologies (TP, PP, DP, EP)
* **Tensor Parallelism (TP):**
  * Shoeybi, M., et al. (2019). *“Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism.”* [[arXiv:1909.08053](https://arxiv.org/abs/1909.08053)]
  * *Why read it:* Explains Column-Parallel and Row-Parallel linear matrix decompositions, and why exactly 2 All-Reduce operations are required per transformer layer over high-speed intra-node NVLink.
* **Pipeline Parallelism (PP) & Pipeline Schedules:**
  * Narayanan, D., et al. (2021). *“Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM.”* [[arXiv:2104.04473](https://arxiv.org/abs/2104.04473)]
  * *Why read it:* Details 3D parallelism ($TP \times PP \times DP$), the 1F1B (One-Forward-One-Backward) schedule, activation stashing, and the analytical derivation of the pipeline bubble ratio $\frac{p - 1}{m + p - 1}$.
  * Huang, Y., et al. (2019). *“GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism.”* NeurIPS 2019. [[arXiv:1811.06965](https://arxiv.org/abs/1811.06965)]
* **Data Parallelism & ZeRO Sharding:**
  * Rajbhandari, S., et al. (2020). *“ZeRO: Memory Optimizations Toward Training Trillion Parameter Models.”* SC20. [[arXiv:1910.02054](https://arxiv.org/abs/1910.02054)]
  * *Why read it:* Explains the 16 bytes/parameter memory footprint of FP16/BF16 mixed-precision AdamW training, and how ZeRO-1, ZeRO-2, and ZeRO-3 eliminate memory redundancy across DP ranks.
* **Mixture of Experts & Expert Parallelism (EP):**
  * Fedus, W., Zoph, B., & Shazeer, N. (2022). *“Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity.”* JMLR. [[arXiv:2101.03961](https://arxiv.org/abs/2101.03961)]
  * *Why read it:* Formulates token routing and the All-to-All collective dispatch communication pattern across compute nodes.

### 3. Collective Communication & Cluster Interconnects
* **Ring All-Reduce & Collective Algorithms:**
  * Pitch Patarasuk & Xin Yuan (2009). *“Bandwidth Optimal All-reduce on Dual-Ported Trees and Rings.”* Parallel Computing.
  * *Why read it:* Derives the canonical transferred data volume $2 \times \frac{N-1}{N} \times S$ bytes used in GraphFlow-AI's communication latency engine.
  * NVIDIA NCCL (NVIDIA Collective Communications Library) Developer Guide. [[NVIDIA NCCL Docs](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/)]
* **Interconnect Topologies (NVLink, NVSwitch, InfiniBand, RoCE):**
  * NVIDIA Hopper & Blackwell Architecture Technical Overviews (whitepapers on NVLink 4/5 900–1800 GB/s bidirectional interconnects vs. 400G/800G NDR InfiniBand).
  * Stas Bekman (2024). *“Machine Learning at Scale / Ultra-Scale Playbook.”* [[GitHub Repository](https://github.com/stas00/ml-engineering)]
  * *Why read it:* Practical engineering handbook on cluster networking, node topologies, NCCL debugging, and multi-node GPU cluster setups.

### 4. Textbooks & Comprehensive Reference Works
* Hennessy, J. L., & Patterson, D. A. *“Computer Architecture: A Quantitative Approach”* (6th or 7th Edition) — specifically Chapter 4 (Data-Level Parallelism in Vector, SIMD, and GPU Architectures) and Appendix F.
* Sze, V., Chen, Y.-H., Yang, T.-J., & Emer, J. S. (2020). *“Efficient Processing of Deep Learning: From Algorithms to Hardware Architectures.”* Morgan & Claypool / MIT.

---

## 📄 License
MIT License. Built for the deep learning research and systems engineering community.
