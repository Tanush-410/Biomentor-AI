import React, { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, TransformControls, Grid, Environment, Line, Text } from '@react-three/drei'

const GEOMETRY_BY_TYPE = {
  cube: (
    <boxGeometry args={[1, 1, 1]} />
  ),
  sphere: (
    <sphereGeometry args={[0.65, 32, 32]} />
  ),
  cylinder: (
    <cylinderGeometry args={[0.6, 0.6, 1.2, 32]} />
  ),
  cone: (
    <coneGeometry args={[0.7, 1.2, 32]} />
  ),
  torus: (
    <torusGeometry args={[0.6, 0.22, 16, 48]} />
  )
}

function ShapeMesh({ shape, isSelected, onSelect, isLineMode, onBondShape, meshRef }) {
  return (
    <mesh
      ref={meshRef}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(shape.id)
        // In line mode, clicking a shape bonds it into the in-progress line
        // instead of (only) selecting it -- the bond then tracks this
        // shape's live position every render, including while it's dragged.
        if (isLineMode) {
          onBondShape(shape.id)
        }
      }}
      castShadow
      receiveShadow
    >
      {GEOMETRY_BY_TYPE[shape.type] || GEOMETRY_BY_TYPE.cube}
      <meshStandardMaterial
        color={shape.color}
        emissive={isSelected ? shape.color : '#000000'}
        emissiveIntensity={isSelected ? 0.25 : 0}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  )
}

// Renders a shape's label as floating text just below it. Uses the shape's
// live position (same as everything else here), so the label tracks the
// shape when it's dragged, just like a bond does.
function ShapeLabel({ shape }) {
  if (!shape.label) return null
  const [x, y, z] = shape.position
  const verticalOffset = (shape.scale?.[1] || 1) * 0.75 + 0.3
  return (
    <Text
      position={[x, y - verticalOffset, z]}
      fontSize={0.28}
      color="#0a0a0a"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.012}
      outlineColor="#f2e9c4"
    >
      {shape.label}
    </Text>
  )
}

function PointMarker({ point, color = '#0a0a0a' }) {
  return (
    <mesh position={point}>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Invisible plane the line tool clicks against, so a click that misses every
// shape can still turn into a real 3D point via event.point. Because R3F
// raycasts nearest-object-first and ShapeMesh's onClick calls
// stopPropagation(), this only ever fires for clicks that don't hit a shape.
function LineDrawingPlane({ onPlaceFreePoint }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onPlaceFreePoint(event.point.toArray())
      }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// A line/bond point is either { shapeId } -- resolved to that shape's live
// position on every render, so it moves when the shape is dragged -- or
// { position } -- a fixed free-floating point. Returns null if the point
// references a shape that no longer exists.
function resolvePoint(point, shapes) {
  if (point.shapeId) {
    const shape = shapes.find((candidate) => candidate.id === point.shapeId)
    return shape ? shape.position : null
  }
  return point.position || null
}

function resolvePoints(points, shapes) {
  return points.map((point) => resolvePoint(point, shapes)).filter(Boolean)
}

export default function ShapeStudioScene({
  shapes,
  selectedId,
  mode,
  onSelect,
  onTransform,
  onDeselect,
  lineDraft = [],
  finishedLines = [],
  onAddLinePoint
}) {
  const meshRefs = useRef({})
  // Tracked in real state (set via the mesh ref callback / an effect keyed on
  // selectedId) rather than read imperatively from meshRefs during render, so
  // the TransformControls gizmo shows up on the same render the shape is
  // selected/created instead of one render late.
  const [selectedObject, setSelectedObject] = useState(null)

  useEffect(() => {
    setSelectedObject(selectedId ? meshRefs.current[selectedId] || null : null)
  }, [selectedId, shapes])

  const isLineMode = mode === 'line'

  return (
    <Canvas
      shadows
      camera={{ position: [4, 3.5, 6], fov: 45 }}
      onPointerMissed={onDeselect}
    >
      <color attach="background" args={['#f2e9c4']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment preset="city" />

      <Grid
        args={[20, 20]}
        cellColor="#00000022"
        sectionColor="#00000044"
        fadeDistance={20}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      {isLineMode && (
        <LineDrawingPlane onPlaceFreePoint={(position) => onAddLinePoint({ position })} />
      )}

      {/* Every line/bond's points are resolved from live shape positions on
          every render (not cached), so a finished bond visibly moves in
          lockstep as its anchor shapes are dragged around. */}
      {finishedLines.map((points, index) => {
        const resolved = resolvePoints(points, shapes)
        return resolved.length > 1 ? (
          <Line key={`line-${index}`} points={resolved} color="#0a0a0a" lineWidth={2.5} />
        ) : null
      })}
      {/* Only mark free (non-shape) points -- a shape-anchored point is
          already visually marked by the shape itself. */}
      {finishedLines.flatMap((points, lineIndex) =>
        points.map((point, pointIndex) => {
          if (point.shapeId) return null
          const resolved = resolvePoint(point, shapes)
          return resolved ? (
            <PointMarker key={`line-${lineIndex}-point-${pointIndex}`} point={resolved} color="#0a0a0a" />
          ) : null
        })
      )}

      {(() => {
        const draftResolved = resolvePoints(lineDraft, shapes)
        return draftResolved.length > 1 ? (
          <Line points={draftResolved} color="#a88a26" lineWidth={2.5} dashed dashSize={0.15} gapSize={0.1} />
        ) : null
      })()}
      {lineDraft.map((point, index) => {
        if (point.shapeId) return null
        const resolved = resolvePoint(point, shapes)
        return resolved ? (
          <PointMarker key={`draft-point-${index}`} point={resolved} color="#a88a26" />
        ) : null
      })}

      {shapes.map((shape) => (
        <React.Fragment key={shape.id}>
          <ShapeMesh
            shape={shape}
            isSelected={shape.id === selectedId}
            onSelect={onSelect}
            isLineMode={isLineMode}
            onBondShape={(shapeId) => onAddLinePoint({ shapeId })}
            meshRef={(el) => {
              meshRefs.current[shape.id] = el
              if (shape.id === selectedId) {
                setSelectedObject(el)
              }
            }}
          />
          <ShapeLabel shape={shape} />
        </React.Fragment>
      ))}

      {selectedObject && !isLineMode && (
        <TransformControls
          object={selectedObject}
          mode={mode}
          onObjectChange={() => {
            if (!selectedObject) return
            onTransform(selectedId, {
              position: selectedObject.position.toArray(),
              rotation: [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z],
              scale: selectedObject.scale.toArray()
            })
          }}
        />
      )}

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate={!isLineMode}
        minDistance={2}
        maxDistance={30}
      />
    </Canvas>
  )
}
