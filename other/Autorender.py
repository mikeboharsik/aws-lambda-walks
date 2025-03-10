import bpy
import os
from os.path import abspath
import glob
import json
from datetime import datetime, timedelta
from pathlib import Path
import re
import winsound

frame_rate = 59.94
resolution_x = 2988
resolution_y = 2988
meta_archive_dir = "C:\\Users\\mboha\\Documents\\GitHub\\walk-routes\\meta_archive"

def get_year_month_date_from_name():
    name = Path(bpy.context.blend_data.filepath).stem
    [year, month, date] = name.split('-')
    return [year, month, date]

def get_expected_meta_filename():
    [year, month, date] = get_year_month_date_from_name()
    return f"{meta_archive_dir}\\{year}\\{month}\\{date}.json"

def get_blend_dir():
    blend_path = bpy.context.blend_data.filepath
    return os.path.dirname(blend_path)

def get_output_dir():
    blend_dir = get_blend_dir()
    return abspath(blend_dir + '\\..\\output')

def get_date():
    return os.path.basename(get_blend_dir())
    
def configure_output():
    bpy.context.scene.render.use_sequencer = True
    bpy.context.scene.render.use_compositing = False

    bpy.context.scene.render.fps = 60
    bpy.context.scene.render.fps_base = 1.0010000467300415
    bpy.context.scene.render.resolution_x = resolution_x
    bpy.context.scene.render.resolution_y = resolution_y
    
    bpy.context.space_data.proxy_render_size = 'SCENE'
    bpy.context.space_data.use_proxies = False
    
    sed = bpy.data.scenes[0].sequence_editor
    sed.use_prefetch = True

bl_info = {
    "name": "MikeBWalks",
    "blender": (4, 0, 2),
    "category": "Object",
}

class MikeBWalksAutoConfig(bpy.types.Operator):
    '''MikeBWalks Config'''
    bl_idname = "object.mikebwalks_auto_config"
    bl_label = "MikeBWalks: Configure environment"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        os.system('cls')
        
        original_context_type = bpy.context.area.type
        if bpy.context.area.type != 'SEQUENCE_EDITOR':
            print(f'Set context to {bpy.context.area.type}')
            bpy.context.area.type = 'SEQUENCE_EDITOR'

        configure_output()

        bpy.context.area.type = original_context_type

        return {'FINISHED'}

class MikeBWalksAutoStrip(bpy.types.Operator):
    '''MikeBWalks Strip'''
    bl_idname = 'object.mikebwalks_auto_strip'
    bl_label = 'MikeBWalks: Strips from events'
    bl_options = {'REGISTER', 'UNDO'}
    
    def load_metadata(self):
        jsonFilename = get_expected_meta_filename()
        if os.path.isfile(jsonFilename):
            metadataFile = open(jsonFilename)
            metadataContent = metadataFile.read()
            metadata = json.loads(metadataContent)
            
            return metadata[-1]
        else:
            print(f'Failed to load meta file with name [{jsonFilename}]')
            return None

    def timespan_to_frame(self, timespan):
        result = re.search(r'(\d{2}):(\d{2}):(\d{2})(\.)*(\d{1,3})*', timespan)
        hours = int(result.group(1))
        minutes = int(result.group(2))
        milliseconds = int(result.group(5) or 0) / 1000
        seconds = int(result.group(3)) + milliseconds

        frames_per_second = 59.94
        frames_per_minute = frames_per_second * 60
        frames_per_hour = frames_per_minute * 60
        
        result = int((hours * frames_per_hour) + (minutes * frames_per_minute) + (seconds * frames_per_second))

        print(f'Timestamp [{timespan}] converted to frame is [{result}]')

        return result

    def create_event_strip(self, event):
        try:
            bpy.ops.sequencer.select_all(action='SELECT')
                
            start_frame = self.timespan_to_frame(event['trimmedStart'])        
            bpy.context.scene.frame_set(start_frame)
            bpy.ops.sequencer.split(side='BOTH')
            print(f'Split at {start_frame}')
            
            end_frame = self.timespan_to_frame(event['trimmedEnd'])
            bpy.context.scene.frame_set(end_frame)  
            bpy.ops.sequencer.split(side='BOTH')
            print(f'Split at {end_frame}')
            
            bpy.ops.sequencer.select_all(action="DESELECT")
            bpy.context.scene.frame_set(bpy.context.scene.frame_current - 1)
            bpy.ops.sequencer.select_side_of_frame(extend=False, side='CURRENT')
            for sequence in bpy.context.selected_sequences:
                sequence.name = event['id']
        except:
            if 'trimmedStart' in event:
                print(f'Failed to create strip for event with name {event["id"]} and trimmedStart of {event["trimmedStart"]}')
            else:
                print(f'Failed to create strip for event with name {event["id"]} which is missing trimmedStart')
    
    def mute_nonevent_strips(self):
        for sequence in bpy.context.sequences:
            if sequence.name.startswith('20'):
                sequence.mute = True
            else:
                sequence.mute = False
    
    def execute(self, context):
        original_context_type = bpy.context.area.type
        if bpy.context.area.type != 'SEQUENCE_EDITOR':
            bpy.context.area.type = 'SEQUENCE_EDITOR'
        
        metadata = self.load_metadata()

        if metadata == None:
            print('Nothing to process')
        else:
            for event in metadata['events']:
                print(f'Reading event [{json.dumps(event)}]')
                if 'name' not in event:
                    print(f'Skipping event with no name')
                elif 'trimmedStart' not in event or 'trimmedEnd' not in event:
                    print(f'Skipping event with no trimmedStart and/or trimmedEnd')
                elif event['name'].upper().startswith('SKIP') or 'skip' in event:
                    print(f'Skipping event with name [{event["name"]}]')
                else:
                    self.create_event_strip(event)
                
            self.mute_nonevent_strips()
                
        bpy.context.area.type = original_context_type
        
        return {'FINISHED'}

class MikeBWalksAutoRender(bpy.types.Operator):
    '''MikeBWalks Render'''
    bl_idname = "object.mikebwalks_auto_render"
    bl_label = "MikeBWalks: Render clips"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):        
        # ensure we have nothing selected
        bpy.ops.sequencer.select_all(action="DESELECT")

        sed = bpy.data.scenes[0].sequence_editor

        # get the list of all the strips currently in the editor
        strips = filter(lambda x: x.type == 'MOVIE' and x.mute == False, sed.sequences_all)
        
        for strip in strips:
            start = strip.frame_final_start
            end = strip.frame_final_end
            
            bpy.data.scenes[0].frame_start = start
            bpy.data.scenes[0].frame_end = end
            
            output_name = get_output_dir() + '\\' + get_date() + "_" + strip.name.replace(' ', '_') + '.mp4'
            bpy.context.scene.render.filepath = output_name
            print(f'Rendering animation [{output_name}]...')
            
            configure_output()
            
            bpy.ops.render.render(animation=True)

        for i in range(3):
            winsound.Beep(1000, 300)
            winsound.Beep(1500, 300)
            winsound.Beep(2000, 300)

        return {'FINISHED'}

def menu_func_config(self, context):
    self.layout.row().separator()
    self.layout.operator(MikeBWalksAutoConfig.bl_idname)

def menu_func_strip(self, context):
    self.layout.operator(MikeBWalksAutoStrip.bl_idname)

def menu_func_render(self, context):
    self.layout.operator(MikeBWalksAutoRender.bl_idname)

def register():
    bpy.utils.register_class(MikeBWalksAutoConfig)
    bpy.utils.register_class(MikeBWalksAutoStrip)
    bpy.utils.register_class(MikeBWalksAutoRender)
    
    bpy.types.SEQUENCER_MT_strip.append(menu_func_config)
    bpy.types.SEQUENCER_MT_strip.append(menu_func_strip)
    bpy.types.SEQUENCER_MT_strip.append(menu_func_render)

def unregister():
    bpy.types.SEQUENCER_MT_strip.remove(menu_func_render)
    bpy.types.SEQUENCER_MT_strip.remove(menu_func_strip)
    bpy.types.SEQUENCER_MT_strip.remove(menu_func_config)
    
    bpy.utils.unregister_class(MikeBWalksAutoRender)
    bpy.utils.unregister_class(MikeBWalksAutoStrip)
    bpy.utils.unregister_class(MikeBWalksAutoConfig)

if __name__ == '__main__':
    register()