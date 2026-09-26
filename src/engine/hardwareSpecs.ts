import { HardwareSpec } from '../types';

// REVIEWER: Hardware specs (TFLOPs, bandwidth) are subject to change as vendors release
// updated datasheets or ErratA. Add a `specVersion` or `lastVerified` field, or at minimum
// link the source datasheet in a comment per entry so maintainers can re-verify.
export const HARDWARE_DATABASE: HardwareSpec[] = [
  {
    id: 'nvidia-b200',
    name: 'NVIDIA B200 SXM (Blackwell)',
    vendor: 'NVIDIA',
    peakTFlopsFP16: 2250,
    peakTFlopsFP8: 4500,
    memoryBandwidthTBps: 8.0,
    vramGBPerGPU: 192,
    nvlinkBandwidthGBps: 1800,
    networkBandwidthGBps: 100, // InfiniBand XDR / 800Gbps
  },
  {
    id: 'nvidia-h100',
    name: 'NVIDIA H100 SXM (Hopper)',
    vendor: 'NVIDIA',
    peakTFlopsFP16: 989,
    peakTFlopsFP8: 1979,
    memoryBandwidthTBps: 3.35,
    vramGBPerGPU: 80,
    nvlinkBandwidthGBps: 900,
    networkBandwidthGBps: 50, // InfiniBand NDR 400Gbps
  },
  {
    id: 'nvidia-h200',
    name: 'NVIDIA H200 SXM (141GB HBM3e)',
    vendor: 'NVIDIA',
    peakTFlopsFP16: 989,
    peakTFlopsFP8: 1979,
    memoryBandwidthTBps: 4.8,
    vramGBPerGPU: 141,
    nvlinkBandwidthGBps: 900,
    networkBandwidthGBps: 50,
  },
  {
    id: 'nvidia-a100',
    name: 'NVIDIA A100 SXM (Ampere)',
    vendor: 'NVIDIA',
    peakTFlopsFP16: 312,
    // REVIEWER: A100 does not support FP8 natively (it was introduced in H100/Hopper).
    // The peakTFlopsFP8 value here (2× FP16) is a placeholder / extrapolation, not a
    // real hardware specification. Mark it clearly as estimated or set it equal to FP16.
    peakTFlopsFP8: 624,
    memoryBandwidthTBps: 2.039,
    vramGBPerGPU: 80,
    nvlinkBandwidthGBps: 600,
    networkBandwidthGBps: 25, // InfiniBand HDR 200Gbps
  },
  {
    id: 'apple-m4-max',
    // REVIEWER: "Speculative Unified" in the name flags that these numbers are estimates.
    // The FP8 figure (240 TFLOPS) is not an official Apple spec — remove or clearly label
    // it as estimated in the UI to avoid misleading roofline comparisons against server GPUs.
    name: 'Apple M4 Max / Ultra (Speculative Unified)',
    vendor: 'Apple',
    peakTFlopsFP16: 120,
    peakTFlopsFP8: 240,
    memoryBandwidthTBps: 0.819, // 819 GB/s Unified Memory
    vramGBPerGPU: 128,
    nvlinkBandwidthGBps: 64, // PCIe / Fabric
    networkBandwidthGBps: 10,
  },
  {
    id: 'google-tpu-v5p',
    name: 'Google TPU v5p (Cloud Pod)',
    vendor: 'Google',
    peakTFlopsFP16: 459,
    peakTFlopsFP8: 918,
    memoryBandwidthTBps: 2.76,
    vramGBPerGPU: 95,
    nvlinkBandwidthGBps: 480, // ICI (Inter-Chip Interconnect)
    networkBandwidthGBps: 50,
  }
];

// REVIEWER: Selecting DEFAULT_HARDWARE by index [1] is brittle — reordering HARDWARE_DATABASE
// silently changes the default. Select by stable id: HARDWARE_DATABASE.find(h => h.id === 'nvidia-h100')!
export const DEFAULT_HARDWARE = HARDWARE_DATABASE[1]; // H100
