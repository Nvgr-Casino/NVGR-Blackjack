# Moves an animation recorded on a Rocketbox (3ds Max Biped) skeleton onto
# the Mixamo skeleton our characters are built on, so the house's sitting,
# standing and walking motions play on the new figures.
#
#   blender -b --python scripts/blender/retarget_clip.py -- <character.blend> <clip.glb> <out.glb>
#
# The two skeletons stand differently at rest (Biped arms straight out,
# MakeHuman's lowered), so each limb is first lined up: the turn that points
# a source bone the way its partner points at rest is taken out of the
# motion. Every frame, each target bone is then given the source bone's
# orientation in the world, less that lining-up and the two rests'
# difference, and keyed as its local rotation. Positions are left alone;
# the table places each figure itself (see rig.js, withoutRootMotion).
import bpy, sys, math
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
char_blend, clip_glb, out_glb = argv[0], argv[1], argv[2]

bpy.ops.wm.open_mainfile(filepath=char_blend)
for o in list(bpy.data.objects):
    if o.type != 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)
tgt = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# The clip's skeleton carries no skin, so it arrives as a tree of empties,
# one per joint. Its rest pose is read from a copy with the animation taken
# out, imported the same way so both are in the same axes.
import json, struct, tempfile, os
def strip_animation(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + jlen])
    doc.pop('animations', None)
    js = json.dumps(doc).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    rest = data[20 + jlen:]
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), 0x4E4F534A) + js + rest
    fd, tmp = tempfile.mkstemp(suffix='.glb'); os.close(fd)
    open(tmp, 'wb').write(out)
    return tmp
def import_joints(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in [o for o in new if o.type == 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    return {o.name.split('.')[0]: o for o in bpy.data.objects if o not in before}
rest_file = strip_animation(clip_glb)
rest_joints = import_joints(rest_file)
bpy.context.view_layer.update()
REST = {n: o.matrix_world.copy() for n, o in rest_joints.items()}
for o in rest_joints.values():
    bpy.data.objects.remove(o, do_unlink=True)
os.remove(rest_file)
joints = import_joints(clip_glb)
actions = [o.animation_data.action for o in joints.values() if o.animation_data and o.animation_data.action]
assert actions, 'the clip has no animation'
action = actions[0]

M = 'mixamorig:'
SIDES = {'L': 'Left', 'R': 'Right'}
MAP = {
    'Bip01 Pelvis': M + 'Hips', 'Bip01 Spine': M + 'Spine', 'Bip01 Spine1': M + 'Spine1', 'Bip01 Spine2': M + 'Spine2',
    'Bip01 Neck': M + 'Neck', 'Bip01 Head': M + 'Head',
}
FINGERS = {'0': 'Thumb', '1': 'Index', '2': 'Middle', '3': 'Ring', '4': 'Pinky'}
for s, side in SIDES.items():
    MAP.update({
        f'Bip01 {s} Clavicle': f'{M}{side}Shoulder', f'Bip01 {s} UpperArm': f'{M}{side}Arm',
        f'Bip01 {s} Forearm': f'{M}{side}ForeArm', f'Bip01 {s} Hand': f'{M}{side}Hand',
        f'Bip01 {s} Thigh': f'{M}{side}UpLeg', f'Bip01 {s} Calf': f'{M}{side}Leg',
        f'Bip01 {s} Foot': f'{M}{side}Foot', f'Bip01 {s} Toe0': f'{M}{side}ToeBase',
    })
    for f, finger in FINGERS.items():
        for j, k in (('', '1'), ('1', '2'), ('2', '3')):
            MAP[f'Bip01 {s} Finger{f}{j}'] = f'{M}{side}Hand{finger}{k}'
MAP = {s: t for s, t in MAP.items() if s in joints and s in REST and t in tgt.data.bones}
BACK = {t: s for s, t in MAP.items()}

def rest_world(arm, name):
    return arm.matrix_world @ arm.data.bones[name].matrix_local
def joint(arm, name):
    if arm is None:
        return REST[name].to_translation()
    return arm.matrix_world @ arm.data.bones[name].head_local
src = None

# Face the source the way the target faces (judged by the line across the
# hips, right to left), so a lean forward stays a lean forward.
def facing(arm, left, right):
    d = joint(arm, left) - joint(arm, right)
    return math.atan2(d.y, d.x)
yaw = facing(tgt, M + 'LeftUpLeg', M + 'RightUpLeg') - facing(None, 'Bip01 L Thigh', 'Bip01 R Thigh')
TURN = Matrix.Rotation(yaw, 4, 'Z')
REST = {n: TURN @ m for n, m in REST.items()}

# The lining-up turn for each target bone: source rest direction (to the
# next bone along the limb) onto the target's. The trunk and head stand
# upright in both rests and keep none; a bone with nothing beyond it takes
# its parent's.
TRUNK = {'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'}
def mapped_child(tname):
    for c in tgt.data.bones[tname].children:
        if c.name in BACK:
            return c.name
    return None
align = {}
for b in tgt.data.bones:  # parents before children
    t = b.name
    if t not in BACK:
        continue
    if t[len(M):] in TRUNK:
        align[t] = Quaternion()
        continue
    c = mapped_child(t)
    if c:
        ds = joint(src, BACK[c]) - joint(src, BACK[t])
        dt = joint(tgt, c) - joint(tgt, t)
        align[t] = ds.rotation_difference(dt) if ds.length > 1e-6 and dt.length > 1e-6 else Quaternion()
    else:
        p = b.parent
        align[t] = align.get(p.name, Quaternion()) if p else Quaternion()

src_rest = {s: REST[s].to_quaternion() for s in MAP}
tgt_rest = {b.name: rest_world(tgt, b.name).to_quaternion() for b in tgt.data.bones}
tgt_inv = tgt.matrix_world.to_quaternion().inverted()

out = bpy.data.actions.new(action.name)
tgt.animation_data_create()
tgt.animation_data.action = out
for pb in tgt.pose.bones:
    pb.rotation_mode = 'QUATERNION'

scene = bpy.context.scene
f0 = int(round(min(a.frame_range[0] for a in actions)))
f1 = int(round(max(a.frame_range[1] for a in actions)))
bones = list(tgt.data.bones)  # parents before children
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    world = {}  # each target bone's new orientation in the world
    for b in bones:
        t = b.name
        if t in BACK:
            s = BACK[t]
            rs = (TURN @ joints[s].matrix_world).to_quaternion()
            world[t] = rs @ src_rest[s].inverted() @ align[t].inverted() @ tgt_rest[t]
        else:
            # Unmapped: carried by its parent, unchanged from rest.
            p = b.parent
            world[t] = (world[p.name] @ tgt_rest[p.name].inverted() @ tgt_rest[t]) if p else tgt_rest[t]
        # Local rotation: what is left once the parent's turn and the rest
        # offset between the two bones are taken out.
        p = b.parent
        base = (world[p.name] @ tgt_rest[p.name].inverted() @ tgt_rest[t]) if p else tgt_rest[t]
        local = base.inverted() @ world[t]
        pb = tgt.pose.bones[t]
        pb.rotation_quaternion = local
        pb.keyframe_insert('rotation_quaternion', frame=f)

# Out: the target skeleton and its new clip, nothing else.
for o in joints.values():
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
tgt.select_set(True)
bpy.context.view_layer.objects.active = tgt
scene.frame_start, scene.frame_end = f0, f1
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='ACTIVE_ACTIONS', export_force_sampling=True, export_skins=True, export_yup=True)
print('RETARGETED', action.name, f1 - f0 + 1, 'frames', len(MAP), 'bones ->', out_glb)
