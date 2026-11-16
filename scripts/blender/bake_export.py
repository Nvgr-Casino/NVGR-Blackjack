# The second half of building a character (run from build_character.py):
# what Blender knows about each surface, baked into plain textures a phone
# can draw, then the figure written out for the game.
#
# Blender's skin and cloth shaders carry what makes a person look real
# rather than moulded: the fine relief of pores and weave, and the soft
# shadow wherever one surface tucks against another (under a collar, in an
# armpit, between fingers, in a fold). None of that survives the trip to a
# game engine as a shader. Baked, it does: per surface, its colour, its
# relief as a normal map, and its ambient occlusion, multiplied into the
# colour. Hair, brows, lashes and eyes keep their own painted textures as
# alpha cut-outs.
import bpy, os
import numpy as np

CUTOUT_WORDS = ('eyebrow', 'eyelash', 'hair', 'short0', 'long0', 'bob0', 'braid', 'ponytail', 'afro', 'high-poly', 'low-poly')
SKIP_WORDS = ('teeth', 'tongue')


def _is(o, words):
    n = o.name.lower()
    return any(w in n for w in words)


def _image(name, size, data=False):
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False, is_data=data)
    if data:
        img.colorspace_settings.name = 'Non-Color'
    return img


def _bake(obj, img, kind, **kw):
    # Every material on the object bakes into the same image: an image node
    # holding it, made the active node.
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        node = nt.nodes.get('__bake__') or nt.nodes.new('ShaderNodeTexImage')
        node.name = '__bake__'
        node.image = img
        nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type=kind, margin=12, use_clear=True, **kw)


def _first_image(obj):
    best = None
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.name != '__bake__':
                nm = n.image.name.lower()
                if 'normal' in nm or 'bump' in nm or 'spec' in nm or 'rough' in nm:
                    continue
                if best is None or 'diffuse' in nm:
                    best = n.image
    return best


def _game_material(name, color_img, normal_img=None, roughness=0.6, alpha=False, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = color_img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
    if normal_img is not None:
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = normal_img
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    if sheen and 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    return m


def _pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(-1, 4)


def bake_and_export(basemesh, out_dir, name, *, body_size=2048, cloth_size=2048, ao_strength=0.75, ao_samples=48):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.use_denoising = False
    tex_dir = os.path.join(out_dir, name + '_tex')
    os.makedirs(tex_dir, exist_ok=True)

    from bl_ext.user_default.mpfb.services.exportservice import ExportService
    ExportService.bake_modifiers_remove_helpers(basemesh, bake_masks=True, bake_subdiv=True, remove_helpers=True, also_proxy=True)
    rig = basemesh.parent if basemesh.parent and basemesh.parent.type == 'ARMATURE' else None
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and (o.parent is rig or o is basemesh or o.parent is basemesh)]

    # The figure stands still for the bake, in its rest pose.
    if rig:
        rig.data.pose_position = 'REST'

    for o in parts:
        if _is(o, SKIP_WORDS):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        part = o.name.split('.')[-1]
        if _is(o, CUTOUT_WORDS):
            img = _first_image(o)
            if img is None:
                continue
            img.pack() if not img.packed_file else None
            o.data.materials.clear()
            o.data.materials.append(_game_material(f'{name}.{part}', img, roughness=0.55, alpha=True))
            print('CUTOUT', o.name, img.name)
            continue
        size = body_size if o is basemesh else cloth_size
        # Colour alone, no light.
        scene.cycles.samples = 1
        albedo = _image(f'{name}_{part}_albedo', size)
        _bake(o, albedo, 'DIFFUSE', pass_filter={'COLOR'})
        # The relief, as a tangent-space normal map.
        normal = _image(f'{name}_{part}_normal', size, data=True)
        _bake(o, normal, 'NORMAL', normal_space='TANGENT')
        # The soft shadow of everything nearby (other parts included).
        scene.cycles.samples = ao_samples
        ao = _image(f'{name}_{part}_ao', size, data=True)
        _bake(o, ao, 'AO')
        a, k = _pixels(albedo), _pixels(ao)
        occ = 1.0 - ao_strength * (1.0 - k[:, :1])
        a[:, :3] *= occ
        albedo.pixels.foreach_set(a.ravel())
        for img in (albedo, normal):
            img.filepath_raw = os.path.join(tex_dir, img.name + '.png')
            img.file_format = 'PNG'
            img.save()
            img.pack()
        skin = o is basemesh
        o.data.materials.clear()
        o.data.materials.append(_game_material(f'{name}.{part}', albedo, normal, roughness=0.5 if skin else 0.86))
        print('BAKED', o.name, size)

    if rig:
        rig.data.pose_position = 'POSE'
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in ('MESH', 'ARMATURE') and (o is rig or o.parent is rig or o is basemesh or o.parent is basemesh):
            o.select_set(True)
    glb = os.path.join(out_dir, name + '.raw.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                              export_skins=True, export_animations=False, export_morph=False, export_yup=True)
    print('EXPORTED', glb, os.path.getsize(glb))
    return glb
