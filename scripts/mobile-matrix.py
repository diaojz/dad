import sys, itertools
from playwright.sync_api import sync_playwright
BASE=sys.argv[1]; OUT=sys.argv[2]; ART=sys.argv[3]; ABOUT=sys.argv[4] if len(sys.argv)>4 else ""
uas={'plain':None,
'wx-ios':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x18003230) NetType/WIFI Language/zh_CN',
'wx-android':'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160065 MMWEBSDK/20231201 MMWEBID/1234 MicroMessenger/8.0.47.2560(0x28002F37) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
'feishu':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Lark/7.20.5 LarkLocale/zh_CN ChannelName/Feishu'}
dims=[(375,667,2),(390,844,3),(430,932,3),(320,658,2),(280,653,2),(412,915,2.6),(768,1024,2),(1024,768,2),(834,1194,2),(1194,834,2),(1024,1366,2),(1366,1024,2)]
pages=[("home",""),("post",ART),("404","404.html")]+([("about",ABOUT)] if ABOUT else [])
JS="""()=>{const d=document.documentElement,e=[];
if(d.scrollWidth>d.clientWidth)e.push('overflow '+d.scrollWidth+'>'+d.clientWidth);
const p=document.querySelector('article p:not([class]), .prose p:not([class])')||document.querySelector('p:not([class])');let mn=99;for(const x of document.querySelectorAll('p,li,a,span,time,small')){if(!x.textContent.trim()||x.closest('svg'))continue;const f=parseFloat(getComputedStyle(x).fontSize);if(f<mn)mn=f;} if(mn<12)e.push('minfont '+mn); if(p&&parseFloat(getComputedStyle(p).fontSize)<16&&p.closest('article,.prose,.letter'))e.push('bodyfont '+getComputedStyle(p).fontSize);
for(const a of document.querySelectorAll('a,button')){if(a.closest('p,li,.prose'))continue;const r=a.getBoundingClientRect();if(r.width&&(r.height<40||r.width<40))e.push('tap '+a.textContent.trim().slice(0,8)+' '+Math.round(r.width)+'x'+Math.round(r.height));}
if([...document.images].some(i=>i.complete&&!i.naturalWidth))e.push('img');
if(!document.body.innerText.trim().length)e.push('empty');
return e}"""
fails=[];n=0
with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True)
  for (w,h,s) in dims:
    for ua,js in itertools.product(uas,[True,False]):
      if not js and ua!='plain': continue
      c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=s,is_mobile=True,has_touch=True,user_agent=uas[ua],java_script_enabled=js)
      pg=c.new_page();bad=[]
      pg.on('console',lambda m:bad.append(m.text) if m.type=='error' else None)
      pg.on('pageerror',lambda e:bad.append(str(e)))
      pg.on('response',lambda r:bad.append(str(r.status)+r.url) if r.status>=400 else None)
      for name,path in pages:
        pg.goto(BASE+path,wait_until='networkidle'); n+=1
        iss=pg.evaluate(JS)
        if iss or bad: fails.append((w,h,ua,js,name,iss,list(bad)));bad.clear()
        if js and ua=='plain' and name in('home','post'): pg.screenshot(path=f"{OUT}/{w}x{h}-{name}.png",full_page=(name=='home'))
      c.close()
    print(w,h,'done',flush=True)
  b.close()
print('checks',n,'fails',len(fails))
for f in fails[:25]: print(f)
