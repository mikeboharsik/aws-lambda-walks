import os
import re
import bpy

clip_frame_count = 120
clip_dir = "D:\\wip\\anniversary\\clips"

targets = []

file_names = os.listdir(clip_dir)
for name in file_names:
    abspath = clip_dir + '\\' + name
    without_extension = name.replace('.webm', '')
    without_id = re.sub(' \[.*?\]', '', without_extension)

    new_target = { 'abspath': abspath, 'without_extension': without_extension, 'without_id': without_id	}

    targets.append(new_target)

print(targets)

bpy.context.scene.frame_end = clip_frame_count * len(targets)

bpy.context.scene.render.resolution_x = 3840
bpy.context.scene.render.resolution_y = 2160

bpy.context.scene.render.fps = 60

'''
for idx, target in enumerate(targets):
  bpy.data.scenes[0].sequence_editor.sequences.new_movie(name="Test", filepath=target, channel=1, frame_start=(idx * clip_frame_count) + idx)
'''


