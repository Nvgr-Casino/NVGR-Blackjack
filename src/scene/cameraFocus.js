// While active, scene.js skips controls.update() — OrbitControls recomputes
// camera.position from its own internal state every call, which would
// otherwise stomp on a scripted camera move such as the glide between seats.
export const cameraOverride = { active: false };
