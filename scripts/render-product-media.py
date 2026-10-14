#!/usr/bin/env python3
"""Compose actual demo-mode Mac screenshots into product assets and step videos.
Requires Pillow and ffmpeg. Does not capture the desktop or fabricate app screens.
"""
from pathlib import Path
import subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'docs/assets'; SHOTS=ASSETS/'screenshots'; VIDEOS=ASSETS/'videos'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def font(size,bold=False):return ImageFont.truetype(BOLD if bold else FONT,size)
def crop_card(name):
    im=Image.open(SHOTS/name).convert('RGB')
    runs=[];start=None
    for y in range(im.height):
        r,g,b=im.getpixel((20,y));white=min(r,g,b)>238
        if white and start is None:start=y
        if not white and start is not None:runs.append((start,y));start=None
    if start is not None:runs.append((start,im.height))
    a,b=max(runs,key=lambda x:x[1]-x[0]);return im.crop((16,max(0,a-4),im.width-16,min(im.height,b+4)))
for name in ['settings','event-details']:
    crop_card(name+'.png').save(SHOTS/(name+'-card.png'))
# A native, code-drawn logo: the ribbon and its current-time pointer.
logo=Image.new('RGBA',(512,512),(0,0,0,0));d=ImageDraw.Draw(logo)
d.rounded_rectangle((28,28,484,484),radius=108,fill='#f5f5f7',outline='#d9d9de',width=2)
d.rounded_rectangle((218,96,296,416),radius=20,fill='#dbe9f9')
d.rounded_rectangle((232,116,282,213),radius=8,fill='#0a84ff')
d.rounded_rectangle((232,224,282,291),radius=8,fill='#63bcc8')
d.rounded_rectangle((232,302,282,390),radius=8,fill='#a48bce')
d.polygon([(145,271),(195,300),(145,329)],fill='#ff453a');d.line((195,300,302,300),fill='#ff453a',width=8)
logo.save(ASSETS/'logo.png')
logo.save(ROOT/'desktop/assets/haru.png')
(ROOT/'desktop/assets').mkdir(exist_ok=True)
logo.save(ROOT/'desktop/assets/haru.icns',format='ICNS')
hero=Image.new('RGB',(1600,1040),'#eef2ed');d=ImageDraw.Draw(hero)
d.rounded_rectangle((26,26,1574,1014),radius=28,fill='#fbfcf9')
hero.paste(logo.resize((84,84)),(86,88),logo.resize((84,84)))
d.text((86,208),'Haru',font=font(80,True),fill='#253b2f')
d.text((88,314),'Your day, at a glance.',font=font(32),fill='#536b5a')
for i,line in enumerate(['A quiet calendar ribbon for macOS.','Always visible. Click to expand.','Google Calendar, close at hand.']):d.text((88,396+i*44),line,font=font(22),fill='#617267')
d.rounded_rectangle((86,596,458,662),radius=12,fill='#e7eee6');d.text((110,616),'24px ribbon  /  macOS  /  MIT',font=font(20,True),fill='#385743')
d.text((88,916),'Actual Mac app captures with sample events.',font=font(17),fill='#7a897e')
rail=Image.open(SHOTS/'rail.png').convert('RGB');rail.thumbnail((28,780));hero.paste(rail,(548,146))
timeline=Image.open(SHOTS/'timeline.png').convert('RGB');timeline.thumbnail((370,820));hero.paste(timeline,(610,132))
card=crop_card('settings.png');card.thumbnail((370,700));hero.paste(card,(1125,220))
d.text((610,84),'CLICK TO EXPAND',font=font(16,True),fill='#6b7b6e');d.text((1125,171),'MAKE IT YOURS',font=font(16,True),fill='#6b7b6e')
hero.save(ASSETS/'hero.png',optimize=True)
sequences={
 '01-ribbon': [('rail.png','01','Keep the day in view',['The resting ribbon is only 24px wide.','Vertical titles are optional.']),('timeline.png','02','Click to expand',['Open the ribbon when you need details.','Mouse hover does not expand it.']),('rail.png','03','Return to your work',['Click outside or use Collapse.','The ribbon stays visible.'])],
 '02-event-edit': [('timeline.png','01','Choose an event',['Click a color block to open its details.']),('event-details.png','02','Inspect the schedule',['Read the title, time and reminder.','Meeting links appear when available.']),('event-edit.png','03','Edit the title',['This recording uses a sample event.','No real calendar writes are shown.']),('event-saved.png','04','Save the change',['The sample timeline updates immediately.','Google write validation is separate.'])],
 '03-appearance': [('settings.png','01','Open Settings',['Display controls stay out of the timeline.']),('settings-adjusted.png','02','Adjust the appearance',['Toggle the background and vertical titles.','Tune the overall transparency.']),('rail-transparent.png','03','Keep only what you need',['Background off: color blocks remain.','Your display settings are saved.'])]
}
with tempfile.TemporaryDirectory(prefix='haru-media-') as tmp:
    tmp=Path(tmp)
    for name,steps in sequences.items():
        listing=[]
        for i,(shot,num,title,lines) in enumerate(steps):
            frame=Image.new('RGB',(1920,1200),'#eef2ed');draw=ImageDraw.Draw(frame)
            draw.text((110,100),'HARU  /  MAC APP DEMO',font=font(23,True),fill='#5b7563')
            draw.text((110,270),num,font=font(96,True),fill='#bdd0be');draw.text((110,440),title,font=font(48,True),fill='#253b2f')
            for j,line in enumerate(lines):draw.text((112,530+j*48),line,font=font(27),fill='#536b5a')
            draw.text((112,1100),'Actual app screenshot sequence · sample data · no audio',font=font(18),fill='#7d8b81')
            im=Image.open(SHOTS/shot).convert('RGB')
            if shot.startswith(('event-details','event-edit','settings')):im=crop_card(shot)
            im.thumbnail((680,1000));x=1400-im.width//2;y=(1200-im.height)//2
            if im.width<60:
                draw.rounded_rectangle((1288,70,1512,1130),radius=24,fill='#d5e0d4')
            frame.paste(im,(x,y));out=tmp/f'{name}-{i}.png';frame.save(out)
            listing += [f"file '{out}'",'duration 3']
        listing += [f"file '{out}'"]
        manifest=tmp/(name+'.txt');manifest.write_text('\n'.join(listing)+'\n')
        subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(manifest),'-vf','fps=24','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(VIDEOS/(name+'.mp4'))],check=True)
        if name=='01-ribbon':
            subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(VIDEOS/(name+'.mp4')),'-vf','fps=5,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',str(ASSETS/'walkthrough.gif')],check=True)
print('Created hero, logo, cropped screenshot cards, three MP4s and a GIF preview.')
