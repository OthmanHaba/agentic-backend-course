"""Generate build/reference-<lang>.docx from pandoc's default, with brand fonts/colors."""
import io, re, subprocess, sys, zipfile

HEAD = {"en": "Playfair Display", "ar": "Tajawal ExtraBold"}
BODY = {"en": "Inter", "ar": "Tajawal"}


def rpr(font, color=None, bold=None, size=None):
    x = f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}" w:eastAsia="{font}"/>'
    if bold is not None:
        x += '<w:b/><w:bCs/>' if bold else '<w:b w:val="0"/><w:bCs w:val="0"/>'
    if color:
        x += f'<w:color w:val="{color}"/>'
    if size:
        x += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    return f'<w:rPr>{x}</w:rPr>'


def patch(xml, sid, new_rpr):
    m = re.search(rf'<w:style [^>]*w:styleId="{sid}".*?</w:style>', xml, re.S)
    if not m:
        return xml
    st = re.sub(r'<w:rPr>.*?</w:rPr>|<w:rPr/>', '', m.group(0), flags=re.S)
    st = st.replace('</w:style>', new_rpr + '</w:style>')
    return xml.replace(m.group(0), st)


def build(lang):
    data = subprocess.check_output(["pandoc", "--print-default-data-file", "reference.docx"])
    zin = zipfile.ZipFile(io.BytesIO(data))
    zout = zipfile.ZipFile(f"build/reference-{lang}.docx", "w", zipfile.ZIP_DEFLATED)
    h, b = HEAD[lang], BODY[lang]
    for it in zin.infolist():
        d = zin.read(it.filename)
        if it.filename == "word/styles.xml":
            x = d.decode("utf8")
            for sid in ("Normal", "BodyText", "FirstParagraph", "Compact"):
                x = patch(x, sid, rpr(b, "272827"))
            x = patch(x, "Title", rpr(h, "FF5723", True, 52))
            x = patch(x, "Subtitle", rpr(h, "272827", False, 28))
            x = patch(x, "Heading1", rpr(h, "FF5723", True, 40))
            x = patch(x, "Heading2", rpr(h, "272827", True, 32))
            x = patch(x, "Heading3", rpr(h, "272827", True, 26))
            x = patch(x, "Heading4", rpr(h, "FF5723", True, 22))
            x = patch(x, "VerbatimChar", rpr("JetBrains Mono", "272827", None, 18))
            x = patch(x, "SourceCode", rpr("JetBrains Mono", "272827", None, 18))
            d = x.encode("utf8")
        zout.writestr(it, d)
    zout.close()


if __name__ == "__main__":
    for l in sys.argv[1:] or ["en", "ar"]:
        build(l)
