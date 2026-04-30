// TableSurface — Skia-backed casino felt with depth
// Renders behind the entire game scene to add real production-quality visuals
// Falls back gracefully to solid color if Skia unavailable
//
// Usage:
//   <View style={{flex:1}}>
//     <TableSurface />
//     <YourGameContent />
//   </View>

import React from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";

let _Skia: any = null;
let _hasSkia = false;
function getSkia() {
  if (_Skia === null) {
    try {
      _Skia = require("@shopify/react-native-skia");
      _hasSkia = true;
    } catch {
      _Skia = false;
      _hasSkia = false;
    }
  }
  return _Skia || null;
}

interface TableSurfaceProps {
  baseColor?: string;
  centerColor?: string;
  vignetteIntensity?: number; // 0-1
}

export default function TableSurface({
  baseColor = "#3D0810",
  centerColor = "#7B1828",
  vignetteIntensity = 0.7,
}: TableSurfaceProps) {
  const Skia = getSkia();
  const { width, height } = Dimensions.get("window");

  // Fallback: solid background if Skia unavailable or web
  if (!Skia || !_hasSkia || Platform.OS === "web") {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
    );
  }

  const { Canvas, RadialGradient, Rect, vec } = Skia;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Base felt color */}
        <Rect x={0} y={0} width={width} height={height} color={baseColor} />
        {/* Radial gradient creates depth — brighter center, darker edges */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height / 2)}
            r={Math.max(width, height) * 0.7}
            colors={[centerColor, baseColor, "rgba(0,0,0,0.4)"]}
            positions={[0, 0.6, 1]}
          />
        </Rect>
        {/* Vignette layer — darkens corners */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height / 2)}
            r={Math.max(width, height) * 0.85}
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0)",
              `rgba(0,0,0,${vignetteIntensity})`,
            ]}
            positions={[0, 0.5, 1]}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
