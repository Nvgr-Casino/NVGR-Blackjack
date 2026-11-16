# Builds one of the house's characters (a dealer, a waiter, a guest or a
# player's figure) in Blender with MPFB (MakeHuman for Blender): body,
# face, skin, eyes, brows, lashes, teeth, hair and clothes, on Mixamo's
# skeleton with every finger. Every asset is MakeHuman's own, shared under
# CC0, so the figure is the house's to use.
#
#   blender -b --python scripts/blender/build_character.py -- <recipe.json> <out-dir>
#
# Writes <out-dir>/<name>.blend (to refine by hand), a preview render
# (<name>_preview.png) and the figure for the game, unoptimised
# (<name>.raw.glb; scripts/optimize-characters.mjs finishes it).
import bpy, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
recipe = json.load(open(argv[0], encoding='utf-8'))
out_dir = argv[1]
os.makedirs(out_dir, exist_ok=True)
name = recipe['name']

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

# An empty scene.
bpy.ops.wm.read_factory_settings(use_empty=True)

info = {
    'name': name,
    'phenotype': {**TargetService.get_default_macro_info_dict(), **recipe.get('phenotype', {})},
    'rig': recipe.get('rig', 'mixamo'),
    'eyes': 'high-poly/high-poly.mhclo',
    'eyebrows': recipe.get('eyebrows', 'eyebrow001/eyebrow001.mhclo'),
    'eyelashes': recipe.get('eyelashes', 'eyelashes01/eyelashes01.mhclo'),
    'teeth': 'teeth_base/teeth_base.mhclo',
    'tongue': 'tongue01/tongue01.mhclo',
    'hair': recipe.get('hair', ''),
    'proxy': '',
    'targets': recipe.get('targets', []),
    'clothes': recipe.get('clothes', []),
    'skin_mhmat': recipe['skin'],
    # Blender's full skin and cloth shaders (pores, weave, seams): baked
    # into plain textures for the game afterwards (bake_export.py).
    'skin_material_type': recipe.get('skin_material_type', 'ENHANCED_SSS'),
    'eyes_material_type': recipe.get('eyes_material_type', 'MAKESKIN'),
    'clothes_material_type': 'MAKESKIN',
    'skin_material_settings': {},
    'eyes_material_settings': {},
    'expressions': [],
    'alternative_materials': {},
}
settings = HumanService.get_default_deserialization_settings()
# Smoothed once: the low base mesh's straight edges (a blocky shoulder, a
# faceted jaw) are much of what makes a figure read as a toy. Thinned again
# for phones when optimised, keeping the rounded outline.
settings['subdiv_levels'] = recipe.get('subdiv', 1)
basemesh = HumanService.deserialize_from_dict(info, settings)
print('BUILT', basemesh.name, [o.name for o in bpy.data.objects])

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + '.blend'))

# The figure for the game: every surface baked to textures, then written
# out (bake_export.py), and a portrait of it as the game will show it.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_export import bake_and_export
glb = bake_and_export(basemesh, out_dir, name, body_size=recipe.get('body_size', 2048), cloth_size=recipe.get('cloth_size', 2048))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + '_baked.blend'))

# A portrait to judge it by: head and shoulders, soft key light.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 900, 1100
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.07, 0.12, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.35

# The figure's height, to frame it.
deps = bpy.context.evaluated_depsgraph_get()
ev = basemesh.evaluated_get(deps)
zs = [(ev.matrix_world @ v.co).z for v in ev.data.vertices]
top = max(zs)
framing = recipe.get('framing', 'bust')
if framing == 'full':
    target, dist, lens = Vector((0, 0, top * 0.5)), top * 2.6, 50
else:
    target, dist, lens = Vector((0, 0, top * 0.86)), top * 0.62, 50
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = lens
scene.collection.objects.link(cam)
cam.location = target + Vector((0, -dist, top * 0.02))
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam

def light(kind, loc, energy, size=1.0, color=(1, 1, 1)):
    l = bpy.data.objects.new(kind, bpy.data.lights.new(kind, 'AREA'))
    l.data.energy = energy; l.data.size = size; l.data.color = color
    l.location = loc
    l.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(l)
light('key', (-top * 0.5, -top * 0.9, top * 1.1), 60 * top, top * 0.5, (1, 0.95, 0.88))
light('fill', (top * 0.7, -top * 0.6, top * 0.9), 18 * top, top * 0.6, (0.85, 0.9, 1))
light('rim', (0, top * 0.8, top * 1.2), 50 * top, top * 0.4)
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

scene.render.filepath = os.path.join(out_dir, name + '_preview.png')
bpy.ops.render.render(write_still=True)
print('RENDERED', scene.render.filepath)

