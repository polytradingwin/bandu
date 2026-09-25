"""Build the free extension using an explicit public-file allowlist."""
import json
import zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
extension=root/'extension'
version=json.loads((extension/'manifest.json').read_text(encoding='utf-8'))['version']
files=['manifest.json','background.js','credentials.js','providers.js','api.js','qwen.js','stream.js','content.js','selection.js','engbetter.js','popup.html','popup.js','ui.css','api-setup.html','api-setup.js','welcome.html']+[f'icons/icon{size}.png' for size in [16,32,48,128]]
docs=['README.md','PRIVACY.md','PROVIDERS.md','LICENSE']
for name in files:
    if not (extension/name).is_file(): raise SystemExit('Missing extension file: '+name)
dist=root/'dist';dist.mkdir(exist_ok=True)
for kind in ['store','manual']:
    destination=dist/f'bandu-{version}-{kind}.zip'
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
        for name in files: archive.write(extension/name,name if kind=='store' else 'extension/'+name)
        if kind=='manual':
            for name in docs: archive.write(root/name,name)
    print(destination.name)
