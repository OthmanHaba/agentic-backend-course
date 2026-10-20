# Render slides of a pptx via macOS Quick Look: move slide N to the front, thumbnail it.
import sys, zipfile, re, subprocess, os, shutil, tempfile
src, out = sys.argv[1], sys.argv[2]
want = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
z = zipfile.ZipFile(src)
pres = z.read('ppt/presentation.xml').decode()
m = re.search(r'<p:sldIdLst>(.*?)</p:sldIdLst>', pres, re.S)
ids = re.findall(r'<p:sldId [^>]*/>', m.group(1))
tmp = tempfile.mkdtemp()
for i, sid in enumerate(ids, 1):
    if want and i not in want: continue
    order = [sid] + [x for x in ids if x != sid]
    p2 = pres.replace(m.group(1), ''.join(order))
    f = os.path.join(tmp, f'slide-{i:02d}.pptx')
    with zipfile.ZipFile(f, 'w', zipfile.ZIP_DEFLATED) as w:
        for it in z.infolist():
            w.writestr(it.filename, p2 if it.filename == 'ppt/presentation.xml' else z.read(it.filename))
    subprocess.run(['qlmanage', '-t', '-s', '1600', '-o', tmp, f], capture_output=True)
    shutil.move(f + '.png', os.path.join(out, f'slide-{i:02d}.png'))
    print(os.path.join(out, f'slide-{i:02d}.png'))
