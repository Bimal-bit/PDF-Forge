"""Bundle 100 commonly used Fontsource families, their four styles, and licenses.

This maintenance script uses the network. The application only reads its local
output. Existing pinned downloads are reused unless --refresh is supplied.
Requires fonttools and brotli in the maintenance Python environment.
"""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import urllib.request
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public/fonts/catalog'
CANDIDATES = '''Roboto|Open Sans|Lato|Montserrat|Source Sans 3|Raleway|PT Sans|
Merriweather|Noto Sans|Noto Serif|Ubuntu|Nunito|Nunito Sans|Poppins|Work Sans|
Inter|Fira Sans|Rubik|Mulish|Roboto Condensed|Roboto Mono|Lora|PT Serif|
Libre Baskerville|Crimson Text|EB Garamond|Playfair Display|Cormorant Garamond|
Spectral|Bitter|Alegreya|Alegreya Sans|Arvo|Cabin|Karla|Libre Franklin|Overpass|
IBM Plex Sans|IBM Plex Serif|IBM Plex Mono|Source Code Pro|Source Serif 4|
Barlow|Barlow Condensed|Barlow Semi Condensed|Archivo|Archivo Narrow|Asap|
Titillium Web|Exo|Exo 2|Josefin Sans|Josefin Slab|Kanit|Prompt|Sarabun|
Public Sans|DM Sans|Space Mono|Noto Sans Display|Noto Serif Display|Literata|
Newsreader|Fraunces|Red Hat Display|Red Hat Text|Red Hat Mono|Jost|Urbanist|
Plus Jakarta Sans|Albert Sans|Figtree|Hanken Grotesk|Instrument Sans|
Schibsted Grotesk|Vollkorn|Cardo|Neuton|Gentium Book Plus|Gentium Plus|
Andada Pro|Faustina|Libre Caslon Text|Tinos|Arimo|Cousine|Carlito|Caladea|
Gelasio|Rambla|Chivo|Chivo Mono|Atkinson Hyperlegible|Atkinson Hyperlegible Next|
Atkinson Hyperlegible Mono|Victor Mono|JetBrains Mono|Fira Sans Condensed|
Fira Sans Extra Condensed|Zilla Slab|IBM Plex Sans Condensed|B612|B612 Mono|
Averia Serif Libre|Averia Sans Libre|Averia Libre|Bodoni Moda|Bree Serif|
Cabin Condensed|Darker Grotesque|Domine|Duru Sans|Eczar|Enriqueta|Gudea|
Imprima|Inria Sans|Inria Serif|Kreon|Kufam|Laila|Libre Caslon Display|
Maitree|Martel|Maven Pro|Merriweather Sans|Noticia Text|Old Standard TT|
Overlock|Petrona|Piazzolla|Recursive|Rosario|Rosarivo|Ruda|Rufina|Sanchez|
Signika|Sintony|Taviraj|Trirong|Varta|Yrsa'''
FAMILIES = [name.strip() for name in CANDIDATES.replace('\n', '').split('|')]
STYLES = ['400-normal', '700-normal', '400-italic', '700-italic']


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'PDFForge-font-bundler'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def bundle(name):
    slug = name.lower().replace(' ', '-')
    folder = DEST / slug
    record_file = folder / 'source.json'
    if record_file.exists() and '--refresh' not in sys.argv:
        record = json.loads(record_file.read_text(encoding='utf-8'))
        convert_faces(folder, record)
        return record
    metadata = json.loads(download(f'https://registry.npmjs.org/@fontsource/{slug}/latest'))
    data = download(metadata['dist']['tarball'])
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        files = {member.name: member for member in archive.getmembers() if member.isfile()}
        wanted = [f'package/files/{slug}-latin-{style}.woff2' for style in STYLES]
        if any(filename not in files for filename in wanted):
            return None
        license_name = next((filename for filename in files if filename.lower() in ['package/license', 'package/license.txt']), None)
        if not license_name:
            raise ValueError(f'No bundled license for {name}')
        folder.mkdir(parents=True, exist_ok=True)
        hashes = {}
        for filename, style in zip(wanted, STYLES):
            font_data = archive.extractfile(files[filename]).read()
            (folder / f'{style}.woff2').write_bytes(font_data)
            hashes[style] = hashlib.sha256(font_data).hexdigest()
        (folder / 'LICENSE.txt').write_bytes(archive.extractfile(files[license_name]).read())
    record = {'family': name, 'id': slug, 'version': metadata['version'],
              'source': metadata['dist']['tarball'], 'sha256': hashes}
    record_file.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    convert_faces(folder, record)
    return record


def convert_faces(folder, record):
    hashes = {}
    for style in STYLES:
        output = folder / f'{style}.ttf'
        compressed = folder / f'{style}.woff2'
        if compressed.exists():
            font = TTFont(compressed, recalcTimestamp=False)
            font.flavor = None
            font.save(output)
            compressed.unlink()
        hashes[style] = hashlib.sha256(output.read_bytes()).hexdigest()
    record['ttfSha256'] = hashes
    (folder / 'source.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    if '--convert' in sys.argv:
        records = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
        for record in records:
            convert_faces(DEST / record['id'], record)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            records = list(pool.map(bundle, FAMILIES))
    chosen = [record for record in records if record][:100]
    if len(chosen) != 100:
        raise ValueError(f'Only {len(chosen)} families contain all four styles')
    # Keep the shipped catalog at exactly 100 families.
    selected = {record['id'] for record in chosen}
    for record in records:
        if record and record['id'] not in selected:
            for file in (DEST / record['id']).iterdir():
                file.unlink()
            (DEST / record['id']).rmdir()
    lines = ['// Generated by scripts/bundle-fonts.py. All assets are browser-local.',
             'export const fontCatalog = [']
    lines += [f'  {{ family: {json.dumps(record["family"])}, id: {json.dumps(record["id"])} }},' for record in chosen]
    lines += ['] as const;', '']
    (ROOT / 'src/lib/fontCatalog.ts').write_text('\n'.join(lines), encoding='utf-8')
    (DEST / 'manifest.json').write_text(json.dumps(chosen, indent=2) + '\n', encoding='utf-8')
    print(f'Bundled {len(chosen)} families, {len(chosen) * 4} faces, with licenses.', flush=True)


if __name__ == '__main__':
    main()
